//
//  Copyright © 2019 Lorenzo Vannuccini, blackravenprod@gmail.com
//  http://www.blackravenproduction.com/portfolio/lorenzo_vannuccini
//
//  This framework is provided 'as-is', without any express or implied
//  warranty. In no event will the authors be held liable for any damages
//  arising from the use of this framework.
//
//  Permission is granted to anyone to use this framework for any purpose,
//  including commercial applications, and to alter it and redistribute it
//  freely, subject to the following restrictions:
//
//    1. The origin of this framework must not be misrepresented; you must not
//       claim that you wrote the original framework. If you use this framework
//       in a product, an acknowledgment in the product documentation would be
//       appreciated but is not required.
//
//    2. Altered source versions must be plainly marked as such, and must not be
//       misrepresented as being the original software.
//
//    3. This notice may not be removed or altered from any source distribution.
//

let glAudioPlayer = 
{
	__activeSources: new Map(),
	__listenerPosition: new glVector3f(0.0),
	__listenerOrientation: new glVector3f(0.0)

}; setInterval(function(){ if(glAudioPlayer.__ctx != null) glAudioPlayer.__ctx.resume(); }, 1000);

glAudioPlayer.__refSource = function(source) {
	glAudioPlayer.__activeSources.set(source, source);
}

glAudioPlayer.__derefSource = function(source) {
	glAudioPlayer.__activeSources.delete(source);
}

glAudioPlayer.__updateSources = function(dt)
{
	glAudioPlayer.__activeSources.forEach( function(source) {
		source.__update(dt);
    });
}

glAudioPlayer.createSource = function(sound, minRange, maxRange) {
	return new glAudioPlayer.Source(sound, minRange, maxRange);
}

glAudioPlayer.Sound = function() {
	this.__audioBuffer = null;
}

glAudioPlayer.Sound.prototype.setAsync = function(url, onLoad)
{
	let self = this;

	if(glAudioPlayer.__initContext())
	{
		let request = new XMLHttpRequest();

		request.open('GET', url, true);
		request.responseType = 'arraybuffer';

		request.onload = function()
		{
			glAudioPlayer.__ctx.decodeAudioData(request.response, function(audioBuffer)
			{
				self.__audioBuffer = audioBuffer;
				if(onLoad != null) onLoad(self);
			});
		};

		request.send();
	}
}

glAudioPlayer.Source = function(audioSound, minRange, maxRange)
{
	this.__audioBuffer = audioSound.__audioBuffer;

	this.__proxyInverseTransform = glMatrix4x4f.identityMatrix();
	this.__proxyTransform = glMatrix4x4f.identityMatrix();
	this.__position = new glVector3f(0.0);
	this.__positional = true;
	this.__decayExp = 2.0;
	this.__loop = false;
	
	if(glAudioPlayer.__initContext())
	{
		this.__gainController = glAudioPlayer.__ctx.createGain();
		
		this.__audioPanner = new PannerNode( glAudioPlayer.__ctx,
		{
			panningModel: 'HRTF',
			distanceModel: 'linear',
			positionX: 0.0,
			positionY: 0.0,
			positionZ: 0.0,
			orientationX: 0.0,
			orientationY: 1.0,
			orientationZ: 0.0,
			refDistance: 0.0,
			maxDistance: 1.0,
			rolloffFactor: 1.0,
			coneInnerAngle: 360,
			coneOuterAngle: 360,
			coneOuterGain: 1.0
		});

		this.setRange(minRange, maxRange);
	}
}

glAudioPlayer.Source.prototype.setProxyMesh = function(meshData, voxelsSize, onFinish)
{
	let self = this;

	if(meshData != null)
	{
		this.__triangleSelector = new glTriangleSelector();

		this.__triangleSelector.setAsync(meshData, voxelsSize, function(){
			if(onFinish != null) onFinish(self);
		});

	} else this.__triangleSelector = null;
}

glAudioPlayer.Source.prototype.setProxyTransform = function(transform)
{
	this.__proxyTransform = new glMatrix4x4f(transform);
	this.__proxyInverseTransform = glMatrix4x4f.inverse(transform);
}

glAudioPlayer.Source.prototype.__updatePositionFromProxyVolume = function(dt)
{
	let closestVoxelPosition = null;
	let listener = this.__proxyInverseTransform.mul(glAudioPlayer.getListenerPosition());
	
	let voxel = this.__triangleSelector.__getVoxel(this.__triangleSelector.__getVoxelCoords(listener), false);
	if(voxel == null)
	{
		let nSamples = 20;
		for(let i = 0; i < nSamples; ++i)
		{
			let subRadius = ((this.__proxyPosition != null) ? glVector3f.distance(this.__proxyPosition, listener) : this.__audioPanner.maxDistance);

			let p = glVector3f.add(listener, glVector3f.mul(glVector3f.random(), subRadius));
			let voxel = this.__triangleSelector.__getVoxel(this.__triangleSelector.__getVoxelCoords(p), false);
			if(voxel != null)
			{
				this.__triangleSelector.__marchVoxel(p, glVector3f.normalize(glVector3f.sub(listener, p)));
				if(this.__proxyPosition == null || glVector3f.squaredDistance(p, listener) < glVector3f.squaredDistance(this.__proxyPosition, listener)) closestVoxelPosition = p;
			}
		}
		
	} else closestVoxelPosition = listener;
   
	if(closestVoxelPosition != null)
	{
		if(this.__proxyPosition == null) this.__proxyPosition = new glVector3f();
		this.__proxyPosition.set( this.__proxyTransform.mul(closestVoxelPosition));
	}
	
	if(this.__proxyPosition != null) {
		this.__position.add(glVector3f.sub(this.__proxyPosition, this.__position).mul(Math.min(dt * 6.0, 1.0)));
	}
}

glAudioPlayer.Source.prototype.__update = function(dt)
{
	if(this.__audioPanner != null)
	{
		if(this.__triangleSelector != null && dt > 0.0) this.__updatePositionFromProxyVolume(dt);

		let minRange = this.__audioPanner.refDistance;
		let maxRange = this.__audioPanner.maxDistance;
		
		let v = glVector3f.sub(this.__position, glAudioPlayer.getListenerPosition());
		let srcDistance = v.length();

		let dRatio = Math.min((srcDistance - minRange) / (maxRange - minRange), 1.0);
		let srcOutsideMinRange = (dRatio > 0.0);

		if(srcOutsideMinRange)
		{
			dRatio = 1.0 - Math.pow(1.0 - dRatio, this.__decayExp);
			
			let l = (minRange + (maxRange - minRange) * dRatio) - srcDistance;
			v = glVector3f.add(this.__position, glVector3f.normalize(v).mul(l));

		} else v = this.__position;
		
		this.__enableSpacialSound3D(srcOutsideMinRange);

		this.__audioPanner.positionX.value = v.x;
		this.__audioPanner.positionY.value = v.y;
		this.__audioPanner.positionZ.value = v.z;
	}
}

glAudioPlayer.Source.prototype.__enableSpacialSound3D = function(flag)
{
	if(flag != this.__positional)
	{
		this.__positional = flag;

		this.__audioSource.disconnect();
		this.__audioPanner.disconnect();
		this.__gainController.disconnect();
		
		if(flag) this.__audioSource.connect(this.__gainController).connect(this.__audioPanner).connect(glAudioPlayer.__ctx.destination);
		else this.__audioSource.connect(this.__gainController).connect(glAudioPlayer.__ctx.destination);
	}
}

glAudioPlayer.Source.prototype.play = function(timeOffset, timeDuration)
{	
	if(glAudioPlayer.__initContext())
	{
		this.stop();
		
		this.__audioSource = glAudioPlayer.__ctx.createBufferSource();
		this.__audioSource.buffer = this.__audioBuffer;
		
		this.__audioSource.connect(this.__gainController).connect(this.__audioPanner).connect(glAudioPlayer.__ctx.destination);
		
		this.__update();
		glAudioPlayer.__refSource(this);

		let self = this;
		this.__audioSource.onended = function() {
			self.stop();
		};
		
		this.__audioSource.loop = this.__loop;
		this.__audioSource.start(null, timeOffset);

		if(timeDuration != null) this.__audioSource.stop(glAudioPlayer.__ctx.currentTime + timeDuration);
	}
}

glAudioPlayer.Source.prototype.playing = function() {
	return (this.__audioSource != null);
}

glAudioPlayer.Source.prototype.stop = function()
{
	if(this.__audioSource != null)
	{
		glAudioPlayer.__derefSource(this);
		
		this.__audioSource.stop();
		this.__audioSource = null;
	}
}

glAudioPlayer.Source.prototype.setLoop = function(flag)
{
	this.__loop = flag;
	if(this.__audioSource != null) this.__audioSource.loop = flag;
}

glAudioPlayer.Source.prototype.setPosition = function(x, y, z)
{
	if(this.__proxyPosition != null) this.__proxyPosition.set(x, y, z);
	this.__position.set(x, y, z);
}

glAudioPlayer.Source.prototype.setDecayExp = function(exp) {
	this.__decayExp = exp;
}

glAudioPlayer.Source.prototype.setOrientation = function(x, y, z)
{
	if(this.__audioPanner != null)
	{
		let v = new glVector3f(x, y, z);

		this.__audioPanner.orientationX.value = v.x;
		this.__audioPanner.orientationY.value = v.y;
		this.__audioPanner.orientationZ.value = v.z;
	}
}

glAudioPlayer.Source.prototype.setRange = function(minRange, maxRange)
{
	if(minRange != null) this.__audioPanner.refDistance = minRange;
	if(maxRange != null) this.__audioPanner.maxDistance = maxRange;
}

glAudioPlayer.Source.prototype.setGain = function(gain) {
	this.__gainController.gain.value = gain;
}

glAudioPlayer.createSound = function(url, onLoad)
{
	let sound = new glAudioPlayer.Sound();
	sound.setAsync(url, onLoad);

	return sound;
}

glAudioPlayer.__initContext = function()
{
	if(glAudioPlayer.__ctx == null && (window.AudioContext || window.webkitAudioContext) != null) glAudioPlayer.__ctx = new (window.AudioContext || window.webkitAudioContext);

	return (glAudioPlayer.__ctx != null);
}

glAudioPlayer.setListenerPosition = function(listenerPosition) {
	this.__listenerPosition.set(listenerPosition);		
}

glAudioPlayer.getListenerPosition = function() {
	return new glVector3f(this.__listenerPosition);
}

glAudioPlayer.setListenerOrientation = function(listenerOrientation) {
	this.__listenerOrientation.set(listenerOrientation);
}

glAudioPlayer.getListenerOrientation = function() {
	return new glVector3f(this.__listenerOrientation);
}

glAudioPlayer.__update = function(dt)
{
	if(glAudioPlayer.__ctx != null)
	{
		let listener = glAudioPlayer.__ctx.listener;

		if(listener.positionX != null)
		{
			listener.positionX.value = this.__listenerPosition.x;
			listener.positionY.value = this.__listenerPosition.y;
			listener.positionZ.value = this.__listenerPosition.z;

		} else listener.setPosition( this.__listenerPosition.x,
									 this.__listenerPosition.y, 
									 this.__listenerPosition.z );			
						
		if(listener.forwardX)
		{
			listener.upX.value = 0.0;
			listener.upY.value = 1.0;
			listener.upZ.value = 0.0;

			listener.forwardX.value = this.__listenerOrientation.x;
			listener.forwardY.value = this.__listenerOrientation.y;
			listener.forwardZ.value = this.__listenerOrientation.z;

		} else listener.setOrientation( this.__listenerOrientation.x, 
										this.__listenerOrientation.y, 
										this.__listenerOrientation.z, 0.0, 1.0, 0.0 );
		

		glAudioPlayer.__updateSources(dt);
	}
}
