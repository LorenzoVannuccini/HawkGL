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

let glShader = function(ctx, shaderType)
{
    this.__ctx = ctx;
    this.__shaderID = this.__ctx.createShader(shaderType);
}

glShader.prototype.free = function()
{
    if(this.__shaderID != null)
    {
        this.__ctx.deleteShader(this.__shaderID);
        this.__shaderID = null;
    }
}

glShader.prototype.getLastError = function() {
    return this.__ctx.getShaderInfoLog(this.__shaderID);
}

glShader.prototype.compile = function(header, shaderSource)
{
    if(header != null && header.length > 0)
    {
        let appendingIndex = shaderSource.indexOf("\n");
        if(appendingIndex < 0) appendingIndex = (shaderSource.length - 1);

        shaderSource = shaderSource.substr(0, appendingIndex + 1) + header + shaderSource.substr(appendingIndex + 1);
    }

    this.__ctx.shaderSource(this.__shaderID, shaderSource);
    this.__ctx.compileShader(this.__shaderID);
    
    return this.__ctx.getShaderParameter(this.__shaderID, this.__ctx.COMPILE_STATUS);
}

glShader.prototype.getShaderID = function() {
    return this.__shaderID;
}
   
let glProgram = function(ctx, vertexShaderSource, fragmentShaderSource)
{
    this.__ctx = ctx;
    let gl = this.__ctx.getGL();

    this.__uniforms = new Map();
    this.__uniformBlockBases = new Map();
    this.__attributesLocations = new Map();
    this.__pendingUpdateUniforms = new Map();

    this.__ready = false;
    this.__vertexShaderName   = "Vertex Shader";
    this.__fragmentShaderName = "Fragment Shader";

    this.__programID = gl.createProgram();
    this.__vertexShader   = new glShader(gl, gl.VERTEX_SHADER);
    this.__fragmentShader = new glShader(gl, gl.FRAGMENT_SHADER);

    this.setSource(vertexShaderSource, fragmentShaderSource);
}

glProgram.prototype.free = function()
{
    if(this.__programID != null)
    {
        if(this.__vertexShader   != null) this.__vertexShader.free();
        if(this.__fragmentShader != null) this.__fragmentShader.free();
        
        this.__ctx.getGL().deleteProgram(this.__programID);
        
        this.__programID = this.__vertexShader = this.__fragmentShader = null;
    }
}

glProgram.prototype.loadAsync = function(vertexShaderPath, fragmentShaderPath, completionHandler)
{         
    let self = this;

    this.__vertexShaderName   = "\"" + vertexShaderPath   + "\"";
    this.__fragmentShaderName = "\"" + fragmentShaderPath + "\"";

    dispatchAsync( function()
    {                                 
        loadFilesAsync([vertexShaderPath, fragmentShaderPath], function(shaderSources)
        {
            if(self.__programID != null)
            {
                self.setSource(shaderSources[0], shaderSources[1]);
    
                let didCompile = self.compile();
                if(completionHandler != null) completionHandler(self, didCompile, (didCompile ? null : self.getLastError()));
            }
        }); 
    });
}

glProgram.prototype.__getAttribLocation = function(name)
{
    let locationID = this.__attributesLocations.get(name);
    if(locationID == null)
    {
        this.bind();
        this.__attributesLocations.set(name, (locationID = this.__ctx.getGL().getAttribLocation(this.__programID, name)));
    }

    return locationID;
}

glProgram.prototype.__getUniformLocation = function(name)
{
    this.bind();
    return this.__ctx.getGL().getUniformLocation(this.__programID, name);
}

glProgram.prototype.__getUniformBlockLocation = function(name)
{
    this.bind();
    return this.__ctx.getGL().getUniformBlockIndex(this.__programID, name);
}

glProgram.prototype.createUniformInt = function(name, value)
{
    let uniform = new glUniformInt(this.__ctx.getGL(), this, name, value);
    this.__uniforms.set(name, uniform);
   
    return uniform;
}

glProgram.prototype.createUniformArrayInt = function(name, size, array)
{
    let uniform = new glUniformArrayInt(this.__ctx.getGL(), this, name, size, array);
    this.__uniforms.set(name, uniform);
   
    return uniform;
}

glProgram.prototype.createUniformBlock = function(name, unitID)
{
    let uniform = new glUniformBlockIndex(this.__ctx.getGL(), this, name, unitID);
    this.__uniformBlockBases.set(name, uniform);
    this.__uniforms.set(name, uniform);
   
    return uniform;
}

glProgram.prototype.createUniformSampler = function(name, unitID) {
    return this.createUniformInt(name, unitID);
}

glProgram.prototype.createUniformArraySampler = function(name, size, array) {
    return this.createUniformArrayInt(name, size, array);
}

glProgram.prototype.createUniformFloat = function(name, value)
{
    let uniform = new glUniformFloat(this.__ctx.getGL(), this, name, value);
    this.__uniforms.set(name, uniform);
   
    return uniform;
}

glProgram.prototype.createUniformArrayFloat = function(name, size, array)
{
    let uniform = new glUniformArrayFloat(this.__ctx.getGL(), this, name, size, array);
    this.__uniforms.set(name, uniform);
   
    return uniform;
}

glProgram.prototype.createUniformVec2 = function(name, x, y)
{
    let uniform = new glUniformVec2(this.__ctx.getGL(), this, name, x, y);
    this.__uniforms.set(name, uniform);

    return uniform;
}

glProgram.prototype.createUniformArrayVec2 = function(name, size, array)
{
    let uniform = new glUniformArrayVec2(this.__ctx.getGL(), this, name, size, array);
    this.__uniforms.set(name, uniform);
   
    return uniform;
}

glProgram.prototype.createUniformVec3 = function(name, x, y, z)
{
    let uniform = new glUniformVec3(this.__ctx.getGL(), this, name, x, y, z);
    this.__uniforms.set(name, uniform);

    return uniform;
}

glProgram.prototype.createUniformArrayVec3 = function(name, size, array)
{
    let uniform = new glUniformArrayVec3(this.__ctx.getGL(), this, name, size, array);
    this.__uniforms.set(name, uniform);
   
    return uniform;
}

glProgram.prototype.createUniformVec4 = function(name, x, y, z, w)
{
    let uniform = new glUniformVec4(this.__ctx.getGL(), this, name, x, y, z, w);
    this.__uniforms.set(name, uniform);

    return uniform;
}

glProgram.prototype.createUniformArrayVec4 = function(name, size, array)
{
    let uniform = new glUniformArrayVec4(this.__ctx.getGL(), this, name, size, array);
    this.__uniforms.set(name, uniform);
   
    return uniform;
}

glProgram.prototype.createUniformMat2 = function(name, matrix)
{
    let uniform = new glUniformMat2(this.__ctx.getGL(), this, name, matrix);
    this.__uniforms.set(name, uniform);

    return uniform;
}


glProgram.prototype.createUniformArrayMat2 = function(name, size, array)
{
    let uniform = new glUniformArrayMat2(this.__ctx.getGL(), this, name, size, array);
    this.__uniforms.set(name, uniform);
   
    return uniform;
}

glProgram.prototype.createUniformMat3 = function(name, matrix)
{
    let uniform = new glUniformMat3(this.__ctx.getGL(), this, name, matrix);
    this.__uniforms.set(name, uniform);

    return uniform;
}

glProgram.prototype.createUniformArrayMat3 = function(name, size, array)
{
    let uniform = new glUniformArrayMat3(this.__ctx.getGL(), this, name, size, array);
    this.__uniforms.set(name, uniform);
   
    return uniform;
}

glProgram.prototype.createUniformMat4 = function(name, matrix)
{
    let uniform = new glUniformMat4(this.__ctx.getGL(), this, name, matrix);
    this.__uniforms.set(name, uniform);

    return uniform;
}

glProgram.prototype.createUniformArrayMat4 = function(name, size, array)
{
    let uniform = new glUniformArrayMat4(this.__ctx.getGL(), this, name, size, array);
    this.__uniforms.set(name, uniform);
   
    return uniform;
}

glProgram.prototype.getUniform = function(name) {
    return this.__uniforms.get(name);
}

glProgram.prototype.update = function()
{
    this.bind();
    
    let self = this;
    this.__uniformBlockBases.forEach( function(uniform)
    {
        let unitID = uniform.get();
        let uniformBlock = self.__ctx.getActiveUniformBlock(unitID);
        
        if(uniformBlock != null) uniformBlock.update();
    });

    this.__pendingUpdateUniforms.forEach( function(uniform) {
        uniform.update();
    });

    this.__pendingUpdateUniforms.clear();
}

glProgram.prototype.getProgramID = function() {
    return this.__programID;
}

glProgram.prototype.setSource = function(vertexShaderSource, fragmentShaderSource)
{
    this.__vertexShaderSource   = vertexShaderSource;
    this.__fragmentShaderSource = fragmentShaderSource;
}

glProgram.prototype.ready = function() {
    return this.__ready;
}

glProgram.prototype.compile = function()
{
    let status = true;

    let header = this.__ctx.__shadingGlobalConstants;
    this.__headerLines = (this.__ctx.__shadingGlobalConstantsLineCount + 1);
    
    status *= this.__vertexShader.compile(  "#define GLES_VERTEX_SHADER 1\n"   + header, this.__vertexShaderSource);
    status *= this.__fragmentShader.compile("#define GLES_FRAGMENT_SHADER 1\n" + header, this.__fragmentShaderSource);

    if(status)
    {
        let gl = this.__ctx.getGL();

        gl.attachShader(this.__programID, this.__vertexShader.getShaderID());
        gl.attachShader(this.__programID, this.__fragmentShader.getShaderID());
        
        this.__ctx.__bindProgramStandardAttributes(this.__programID);
        
        gl.linkProgram(this.__programID); 
        status *= gl.getProgramParameter(this.__programID, gl.LINK_STATUS);

        this.__ctx.__createProgramStandardUniforms(this);
    }

    this.__ready = status;
    this.__uniforms.forEach( function(uniform) {
        uniform.__bindUniformLocation();
    });
    
    return status;
}

glProgram.__parseShaderError = function(errorMsg, headerLines)
{
    let errorInfo =
    {
        message: errorMsg,
        line: null
    };

    errorInfo.message = errorInfo.message.replace("ERROR: ", ""); // strip away first "ERROR:" tag

    let nextErrorOccurence = errorInfo.message.indexOf("ERROR: "); // strip away other errors, if present
    errorInfo.message = errorInfo.message.substr(0, ((nextErrorOccurence > 0) ? nextErrorOccurence : errorInfo.message.length)); 

    errorInfo.line = (parseInt(errorInfo.message.substr(errorInfo.message.indexOf(":") + 1)) - ((headerLines != null) ? headerLines : 0));
    if(isNaN(errorInfo.line) || errorInfo.line < 0) errorInfo.line = null;
    
    errorInfo.message = errorInfo.message.substr(errorInfo.message.indexOf(":") + 1);
    errorInfo.message = errorInfo.message.substr(errorInfo.message.indexOf(":") + 1);
    
    return errorInfo;
}

glProgram.prototype.getLastError = function() 
{
    let error = "";
    let gl = this.__ctx.getGL();

    let vsError = this.__vertexShader.getLastError();
    let fsError = this.__fragmentShader.getLastError();

    if(vsError.length > 0)
    {
        let errorInfo = glProgram.__parseShaderError(vsError, this.__headerLines);
        error += this.__vertexShaderName + " Error" + ((errorInfo.line != null) ? (" at line " + errorInfo.line) : "") + ":" + errorInfo.message + "\n";
    }
        
    if(fsError.length > 0)
    {
        let errorInfo = glProgram.__parseShaderError(fsError, this.__headerLines);
        error += this.__fragmentShaderName + " Error" + ((errorInfo.line != null) ? (" at line " + errorInfo.line) : "") + ":" + errorInfo.message + "\n";
    }
        
    if(error.length < 1 && !gl.getProgramParameter(this.__programID, gl.LINK_STATUS)) error += this.__fragmentShaderName + " Error: linking failed\n";

    return error;
}

glProgram.prototype.bind = function() {
    this.__ctx.bindProgram(this);
}

glProgram.prototype.unbind = function() {
    this.__ctx.unbindProgram();
}

glProgram.prototype.runPostProcess = function()
{
    let gl = this.__ctx.getGL();

    let wasCullingEnabled = gl.isEnabled(gl.CULL_FACE);
    if(wasCullingEnabled) gl.disable(gl.CULL_FACE);

    this.bind();
    this.__ctx.__uniformRectMesh.render();

    if(wasCullingEnabled) gl.enable(gl.CULL_FACE);
}
