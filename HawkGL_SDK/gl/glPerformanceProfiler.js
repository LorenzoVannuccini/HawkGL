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

let glPerformanceProfiler = function(ctx)
{
    this.__ctx = ctx;
    this.__dtq = ctx.__extensions.disjointTimerQuery;

    this.__profilingBlocks = new Map();
    this.__profilingStack = [];
    this.__activeQuery = null;

    this.__iterationCount = 0;
    this.__requestEnabled = true;
    this.__enabled = true;
}

glPerformanceProfiler.__genUniqueIdentifier = function()
{
    if(glPerformanceProfiler.__uniqueIdentifier == null) glPerformanceProfiler.__uniqueIdentifier = 0;
    return ++glPerformanceProfiler.__uniqueIdentifier;
}

glPerformanceProfiler.prototype.create = function() {
    return "sID{" + glPerformanceProfiler.__genUniqueIdentifier() + "}";
}

glPerformanceProfiler.prototype.push = function(name)
{
    if(this.__dtq == null || !this.__enabled || name == null || name.length < 1) return;
 
    let self = this;
    let dtq = this.__dtq;
    let gl = this.__ctx.getGL();
    
    let block = this.__profilingBlocks.get(name);
    if(block == null)
    {
        let parentRoot = null;
        let queryDepth = this.__profilingStack.length;
        if(queryDepth > 0)
        {
            parentRoot = this.__profilingStack[queryDepth - 1].parentRoot;
            parentRoot.stackDepth = Math.max(parentRoot.stackDepth, queryDepth + 1);
        }

        this.__profilingBlocks.set(name, (block = 
        {
            parentRoot: parentRoot,
            queryDepth: queryDepth,
            stackDepth: 1,
            
            query: gl.createQuery(),
            performanceMax: null,
            performanceMin: null,
            performanceAvg: null,
            performanceCnt: 0,
            pending: false,

            start: function() 
            {
                if(!this.pending && self.__activeQuery == null && ((self.__iterationCount % this.parentRoot.stackDepth) == this.queryDepth))
                { 
                    gl.beginQuery(dtq.TIME_ELAPSED_EXT, this.query);
                    self.__activeQuery = this;
                }
            },

            end: function()
            {
                if(!this.pending && self.__activeQuery == this)
                {
                    gl.endQuery(dtq.TIME_ELAPSED_EXT);
                    gl.flush();
                    
                    self.__activeQuery = null;
                    this.pending = true;
                }
            },

            update: function()
            {
                if(this.pending && gl.getQueryParameter(this.query, gl.QUERY_RESULT_AVAILABLE))
                {
                    let sample = gl.getQueryParameter(this.query, gl.QUERY_RESULT);
                   
                    this.performanceCnt = Math.min(this.performanceCnt + 1, 100);
                    if(this.performanceCnt > 1)
                    {
                        this.performanceMin = Math.min(this.performanceMin, sample);
                        this.performanceMax = Math.max(this.performanceMax, sample);
                        this.performanceAvg += (sample - this.performanceAvg) * (1.0 / this.performanceCnt);
                        this.performanceLst = sample;

                    } else this.performanceMin = this.performanceMax = this.performanceAvg = sample;

                    this.pending = false;
                }
            }
        }));

        if(block.parentRoot == null) block.parentRoot = block;
    }

    this.__profilingStack.push(block);
    block.start();
}

glPerformanceProfiler.prototype.pop = function()
{
    if(this.__dtq == null || !this.__enabled) return;
 
    let block = this.__profilingStack.pop();
    block.end();
}

glPerformanceProfiler.prototype.update = function()
{
    this.__enabled = this.__requestEnabled;

    if(this.__dtq == null || !this.__enabled) return;
 
    ++this.__iterationCount;

    this.__profilingBlocks.forEach( function(block) {
        block.update();
    });
}

glPerformanceProfiler.prototype.enable = function(flag)
{
    if(flag == null) flag = true;
    this.__requestEnabled = flag;
}

glPerformanceProfiler.prototype.disable = function(flag)
{
    if(flag == null) flag = true;
    this.__requestEnabled = !flag;
}

glPerformanceProfiler.prototype.enabled = function() {
    return (this.__dtq != null && this.__requestEnabled);
}

glPerformanceProfiler.prototype.supported = function() {
    return (this.__dtq != null);
}

glPerformanceProfiler.prototype.clear = function(name)
{
    if(this.__dtq == null) return;

    if(name != null && name.length > 0)
    {
        let block = this.__profilingBlocks.get(name);

        block.performanceMax = null;
        block.performanceMin = null;
        block.performanceAvg = null;
        block.performanceCnt = 0;
    }
    else this.__profilingBlocks.forEach( function(block)
    {
        block.performanceMax = null;
        block.performanceMin = null;
        block.performanceAvg = null;
        block.performanceCnt = 0;
    });
}

glPerformanceProfiler.prototype.get = function(name)
{
    let output = 
    {
        maxMs: null,
        minMs: null,
        avgMs: null,
        curMs: null,
    };

    let block = null;
    if(this.__dtq != null && this.__requestEnabled) block = this.__profilingBlocks.get(name);

    if(block != null)
    {
        output.maxMs = block.performanceMax;
        output.minMs = block.performanceMin;
        output.avgMs = block.performanceAvg;
        output.curMs = block.performanceLst;
        
        if(output.maxMs != null) output.maxMs = Math.round(output.maxMs) * 1e-6;
        if(output.minMs != null) output.minMs = Math.round(output.minMs) * 1e-6;
        if(output.avgMs != null) output.avgMs = Math.round(output.avgMs) * 1e-6;
        if(output.curMs != null) output.curMs = Math.round(output.curMs) * 1e-6;
    }

    return output;
}
