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

glShader.__strReplaceAll = function(input_str, find, replace, fromIndex) 
{
    function escapeRegExp(str) {
        return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
    }

    // Create a word-boundary regex to match whole words
    var regex = new RegExp('\\b' + escapeRegExp(find) + '\\b', 'g');

    let str = input_str;
    if(fromIndex != null) str = input_str.substring(fromIndex);

    str = str.replace(regex, replace);

    if(fromIndex != null) str = input_str.substring(0, fromIndex) + str;

    return str;
}

glShader.__strReplaceFunctionCall = function(str, functionName, newName)
{
    // Create a regular expression to match the key followed by optional spaces and an opening parenthesis
    const regex = new RegExp(`(?<!\\.)\\b${functionName}\\s*\\(`, 'g');
    
    // Replace all occurrences of the key followed by optional spaces and '(' with the new key followed by '('
    return str.replace(regex, `${newName}(`);
}

glShader.__appendToCommentedLines = function(inputStr, appendStr) {
    return inputStr.replace(/^.*\/\/.*$/gm, match => match + appendStr);
}

glShader.__parseConstructorCalls = function(inputString, constructors) 
{
    constructors.forEach( constructorName => {
        inputString = glShader.__strReplaceFunctionCall(inputString, constructorName, "_call_constructor_x" + constructorName + "x_");
    });

    return inputString;
}

glShader.__injectSrcBlock = function(inputString, atIndex, beginSrc, endSrc)
{
    let singleLineComment = false;
    let multiLineComment  = false;
    
    let srcBlockBeginIndex = -1;
    let srcBlockEndIndex = -1;
    let bracketsCount = 0;

    let preceedingString = inputString.slice(0, atIndex);
    inputString = inputString.slice(atIndex);
    
    for(let i = 0, e = inputString.length; (i != e && srcBlockEndIndex < 0); ++i)
    {
        let c = inputString[i];
        
        if(i > 0)
        {
            let c2 = (inputString[i - 1] + c);

            if(c  == "\n") singleLineComment = false;
            if(c2 == "//") singleLineComment = true;
            if(c2 == "/*" && !singleLineComment) multiLineComment  = true;
            if(c2 == "*/") multiLineComment = false;
        }

        let is_comment = (singleLineComment || multiLineComment);
        if(!is_comment)
        {
            if(c == "{" && (++bracketsCount == 1)) srcBlockBeginIndex = i;
            if(c == "}" && (--bracketsCount == 0)) srcBlockEndIndex = i;
        }
    }

    if(srcBlockBeginIndex >= 0 && srcBlockEndIndex >= 0)
    {
        let a = inputString.slice(0, srcBlockBeginIndex + 1);
        let b = inputString.slice(srcBlockBeginIndex + 1, srcBlockEndIndex);
        let c = inputString.slice(srcBlockEndIndex);

        inputString = a + beginSrc + b + endSrc + c;
    }

    return preceedingString + inputString;
}

glShader.__parseMethodCalls = function(inputString, methods, staticMethods, recursionCount) 
{
    if(recursionCount == null) recursionCount = 0;

    if(recursionCount >= glShader.__parserRecursionMaxIterations) // safe-guard
    {
        glShader.__parserAborted = true;
        return inputString;
    }

    if(methods.size == 0) return inputString;

    // Define the regular expression pattern for matching object method calls
    let pattern = /([\w\[\]\.]+)\s*\.\s*(\w+)\s*\(([^)]*)\)/g;

    // Define a variable to hold the match results
    let match;
    
    // Define a string to build the modified string
    let modifiedString = inputString;
    let parsingComplete = true;

    // Loop through all matches in the input string
    for(let i = 0; ((match = pattern.exec(inputString)) !== null && !glShader.__parserAborted); ++i)
    {
        if(i >= glShader.__parserMatchMaxIterations) // safe-guard
        {
            glShader.__parserAborted = true;
            break;
        }

        let methodName = match[2];

        let staticMethod = staticMethods.has(methodName);
        if(!staticMethod && !methods.has(methodName)) continue;
        
        // Capture the object name, method name, and parameters
        let objectName = match[1];
        let params = match[3].trim();
        
        // strip comments
        let hasParams = (params.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '').length > 0);
        
        // Construct the new method call
        let newMethodCall = staticMethod ? `_call_static_method_x${objectName}x_x${methodName}x_(${params})`
                                         : `_call_method_x${methodName}x_(${objectName}` + (hasParams ? `, ` : ``) + `${params})`;
        
        // Replace each matched pattern with the new method call format
        modifiedString = modifiedString.replace(match[0], newMethodCall);
        parsingComplete = false;
    }
    
    if(!parsingComplete) modifiedString = glShader.__parseMethodCalls(modifiedString, methods, staticMethods, recursionCount + 1);

    // Return the modified string
    return modifiedString;
}

glShader.__parseMethodDefinitions = function(inputString) 
{
    inputString = glShader.__appendToCommentedLines(inputString, " //");
    inputString = glShader.__strReplaceAll(inputString, "this", "_this");
    
    // Define the regular expression pattern for capturing class names and keywords
    let pattern = /(?:\b(\w+)\b\s+)?(\w+\s+)?(\w+)\s*::\s*(\w+)\s*\(([^)]*)\)(?:\s+\b(\w+)\b)?/g;
     
    let methods = [], staticMethods = [], constructors = [];

    // Define a variable to hold the match results
    let match;
    
    // Loop through all matches in the input string
    for(let i = 0; ((match = pattern.exec(inputString)) !== null && !glShader.__parserAborted); ++i)
    {
        if(i >= glShader.__parserMatchMaxIterations) // safe-guard
        {
            glShader.__parserAborted = true;
            break;
        }

        // Capture the class name and method name
        let preceedingWord = match[1];
        let returnType = match[2];
        let className = match[3];
        let methodName = match[4];
        let params = match[5].trim();
        let followingWord = match[6];

        // strip comments
        let hasParams = (params.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '').length > 0);

        // Determine the replacement pattern
        let isConstructor = (className == methodName);
        
        if(followingWord  == null) followingWord = "";
        if(preceedingWord == null) preceedingWord = "";
        if(returnType     == null) returnType = "";
        
        // combine preceeding word and return type in the same match
        returnType = preceedingWord + " " + returnType;

        let returnTypeCommentStripped = returnType.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        let followingWordCommentStripped = followingWord.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');

        let staticMethod = /\bstatic\b/i.test(returnTypeCommentStripped);
        let constMethod  = /\bconst\b/i.test(followingWordCommentStripped);

        // Add the captured method name to the keywords array
        if(isConstructor) constructors.push(methodName);
        else if(staticMethod) staticMethods.push(methodName);
        else methods.push(methodName);

        if(staticMethod && !isConstructor) returnType = glShader.__strReplaceAll(returnType, "static", "");

        let thisQualifier = (constMethod ? "const" : "inout");

        let newPattern = isConstructor ? (`${returnType} ${className} _call_constructor_x${className}x_(${params}) ${followingWord}`) :
                         staticMethod  ? (`${returnType} _call_static_method_x${className}x_x${methodName}x_(${params}) ${followingWord}`)
                                       : (`${returnType} _call_method_x${methodName}x_(${thisQualifier} ${className} _this` +  (hasParams ? `, ` : ``) + `${params})`);
                               
        if(isConstructor) inputString = glShader.__injectSrcBlock(inputString, match.index, " " + className + " _this; ", " return _this; ");

        inputString = inputString.replace(match[0], newPattern);
    }

    // Replace all occurrences of "::" with "_" in the modified string
    inputString = inputString.replace(/\s*::\s*/g, '_');

    if(constructors.length > 0) inputString = glShader.__parseConstructorCalls(inputString, new Set(constructors));
    if(methods.length > 0 || staticMethods.length > 0) inputString = glShader.__parseMethodCalls(inputString, new Set(methods), new Set(staticMethods));
    
    return inputString;
}

glShader.prototype.compile = function(header, shaderSource)
{
    if(header != null && header.length > 0)
    {
        let appendingIndex = shaderSource.indexOf("\n");
        if(appendingIndex < 0) appendingIndex = (shaderSource.length - 1);

        shaderSource = shaderSource.substr(0, appendingIndex + 1) + header + shaderSource.substr(appendingIndex + 1);
    }

    if(/\bclass\b/i.test(shaderSource)) // serialize object-oriented code
    {
        glShader.__parserAborted = false;
        glShader.__parserMatchMaxIterations = 1000000;
        glShader.__parserRecursionMaxIterations = 256;
        
        shaderSource = glShader.__strReplaceAll(shaderSource, "class", "struct");
        shaderSource = glShader.__parseMethodDefinitions(shaderSource);

        if(glShader.__parserAborted) console.error("ERROR: shader parsing aborted, iteration limit reached!");

        // console.log(shaderSource);
    }

    this.__ctx.shaderSource(this.__shaderID, shaderSource);
    this.__ctx.compileShader(this.__shaderID);
    
    return this.__ctx.getShaderParameter(this.__shaderID, this.__ctx.COMPILE_STATUS);
}

glShader.prototype.getShaderID = function() {
    return this.__shaderID;
}
   
// -------------------------------------------------------------------------------------------

let glProgram = function(ctx, vertexShaderSource, fragmentShaderSource)
{
    this.__ctx = ctx;
    let gl = this.__ctx.getGL();

    this.__uniforms = new Map();
    this.__dataSamplers = new Map();
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
        this.__bind();
        this.__attributesLocations.set(name, (locationID = this.__ctx.getGL().getAttribLocation(this.__programID, name)));
    }

    return locationID;
}

glProgram.prototype.__getUniformLocation = function(name)
{
    this.__bind();
    return this.__ctx.getGL().getUniformLocation(this.__programID, name);
}

glProgram.prototype.__getUniformBlockLocation = function(name)
{
    this.__bind();
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

glProgram.prototype.createUniformSamplerData = function(name, unitID)
{
    let uniform = new glUniformSamplerData(this.__ctx.getGL(), this, name, unitID);

    this.__uniforms.set(name + ".sampler", uniform.__sampler);
    this.__uniforms.set(name + ".unitID", uniform.__unitID);

    this.__dataSamplers.set(name, uniform);
   
    return uniform;
}

glProgram.prototype.createUniformSamplerGeoData = function(name, nodesUnitID, attribUnitID, verticesUnitID, trianglesUnitID)
{
    let uniform = new glUniformSamplerGeoData(this.__ctx.getGL(), this, name, nodesUnitID, attribUnitID, verticesUnitID, trianglesUnitID);
    
    this.__uniforms.set(name + ".vertexSampler", uniform.__vertexSampler);
    this.__uniforms.set(name + ".attribSampler", uniform.__attribSampler);
    this.__uniforms.set(name + ".faceSampler",   uniform.__faceSampler);
    this.__uniforms.set(name + ".nodeSampler",   uniform.__nodeSampler);
    
    return uniform;
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
    this.__bind();
    
    let self = this;
    
    if(this.__dataSamplers.size > 0)
    {
        let textureDataDescriptors = this.__ctx.__standardUniformsBlock._glTextureDataDescriptors.get();
        let shouldUpdateTextureDataDescriptors = false;
        
        this.__dataSamplers.forEach( function(uniform)
        {
            let textureUnitID = uniform.get();
            let activeTexture = self.__ctx.getActiveTexture(textureUnitID);
            let dataTexture = ((activeTexture != null) ? activeTexture.__dataTexture : null);
            
            if(dataTexture != null)
            {
                let boundDescriptor = textureDataDescriptors[textureUnitID];
                let descriptor = dataTexture.__descriptor;
                
                let shouldUpdateDescriptor = ( boundDescriptor.x != descriptor.capacity      ||
                                               boundDescriptor.y != descriptor.localSize     || 
                                               boundDescriptor.z != descriptor.workGroupSize || 
                                               boundDescriptor.w != descriptor.workGroupSizeSquared );

                if(shouldUpdateDescriptor)
                {
                    boundDescriptor.x = descriptor.capacity;
                    boundDescriptor.y = descriptor.localSize;
                    boundDescriptor.z = descriptor.workGroupSize;
                    boundDescriptor.w = descriptor.workGroupSizeSquared;
                    
                    shouldUpdateTextureDataDescriptors = true;
                }
            }
        });

        if(shouldUpdateTextureDataDescriptors) {
            this.__ctx.__standardUniformsBlock._glTextureDataDescriptors.set(textureDataDescriptors);
        }
    }

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

glProgram.prototype.__getHeader = function() {
    return this.__ctx.__shadingGlobalConstants;
}

glProgram.prototype.__getHeaderLines = function() {
    return this.__ctx.__shadingGlobalConstantsLineCount;
}

glProgram.prototype.compile = function()
{
    let status = true;

    let header = this.__getHeader();
    this.__headerLines = (this.__getHeaderLines() + 1);
    
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
        
        this.__ctx.__bindProgramStandardUniformsBlock(this);

        let shaderDebugger = this.__ctx.__extensions.shadersDebugger;
        if(shaderDebugger != null)
        {
            this.__vertexShaderSourceCompiled = shaderDebugger.getTranslatedShaderSource(this.__vertexShader.getShaderID());
            this.__fragmentShaderSourceCompiled = shaderDebugger.getTranslatedShaderSource(this.__fragmentShader.getShaderID());
        }
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
    if(isNaN(errorInfo.line) || errorInfo.line <= 0) errorInfo.line = null;
    
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
    else if(fsError.length > 0)
    {
        let errorInfo = glProgram.__parseShaderError(fsError, this.__headerLines);
        error += this.__fragmentShaderName + " Error" + ((errorInfo.line != null) ? (" at line " + errorInfo.line) : "") + ":" + errorInfo.message + "\n";
    }
        
    if(error.length < 1 && !gl.getProgramParameter(this.__programID, gl.LINK_STATUS)) error += this.__fragmentShaderName + " Error: linking failed\n";

    return error;
}

glProgram.prototype.__bind = function() {
    this.__ctx.bindProgram(this);
}

glProgram.prototype.__unbind = function() {
    this.__ctx.unbindProgram();
}

glProgram.prototype.bind = function() {
    this.__bind();
}

glProgram.prototype.unbind = function() {
    this.__unbind();
}

glProgram.prototype.runPostProcess = function()
{
    let gl = this.__ctx.getGL();

    let wasCullingEnabled = gl.isEnabled(gl.CULL_FACE);
    if(wasCullingEnabled) gl.disable(gl.CULL_FACE);

    this.__bind();
    this.__ctx.__uniformRectMesh.render();

    if(wasCullingEnabled) gl.enable(gl.CULL_FACE);
}

// -------------------------------------------------------------------------------------------

let glComputeProgram = function(ctx, computeShader)
{
    this.__ctx = ctx;

    glProgram.call(this, ctx, computeShader);
    this.__vertexShaderName = this.__fragmentShaderName = "Compute Shader";
};

glComputeProgram.prototype = Object.create(glProgram.prototype);

glComputeProgram.__nextSquared = function(x) 
{ 
    let s = Math.sqrt(x);
    let n = Math.floor(s);
    
    return ((n != s) ? (n + 1) : s); 
}

glComputeProgram.prototype.compile = function()
{
    /*                                                                                                                                                                  
        glNumInvocations:     number of invocations passed to the dispatch function                                                                                     
        glInvocationSize:     number of outputs (vec4) per invocation, constant                                                                                         
        glNumWorkGroups:      number of dispatched working groups: ceil(glNumInvocations / glWorkGroupSize)                                                                               
        glWorkGroupSize:      number of invocations per working group, specified client side                                                      
        glWorkGroupID:        current work group ID, in range [0, glNumWorkGroups - 1], overridable                                                                     
        glLocalInvocationID:  current invocation within the work group, in range [0, glWorkGroupSize - 1]                                                               
        glGlobalInvocationID: invocation among all invocations of dispatch call, in range [0, glNumInvocations]: (glWorkGroupID * glWorkGroupSize + glLocalInvocationID)
        glData[outputID]:     invocation output (vec4), for outputID in range [0, glInvocationSize - 1]                                                                                                                               
    */                                                                                                                                                                  

    this.__invocationSize = null;
    if(this.__vertexShaderSource == null) return false;

    let local_size_str = this.__vertexShaderSource.replace(/(\/\*[^]*?\*\/|\/\/.*)\n?/g, "");
    local_size_str = local_size_str.replace(/(\r\n|\n|\r)/gm, "");
    
    let local_size_index = local_size_str.indexOf("local_size");
    if(local_size_index < 0) return false;

    this.__invocationSize = parseInt(local_size_str.substr(local_size_index).match(/^.*?\([^\d]*(\d+)[^\d]*\).*$/)[1]);
    
    this.__header = "highp int glWorkGroupID = 0;                                                                                                                                                  \n" +
                    "highp int glNumInvocations = 0;                                                                                                                                               \n" +
                    "highp int glLocalInvocationID = 0;                                                                                                                                            \n" +
                    "highp int glGlobalInvocationID = 0;                                                                                                                                           \n" +
                    "const highp int glInvocationSize = " + this.__invocationSize + ";                                                                                                             \n" +
                    "highp vec4 glData[glInvocationSize];                                                                                                                                          \n" +
                    "                                                                                                                                                                              \n" +
                    "uniform highp int glNumWorkGroups;                                                                                                                                            \n" +
                    "uniform highp int glWorkGroupSize;                                                                                                                                            \n" +
                    "uniform highp int glStartWorkGroupID;                                                                                                                                         \n" +
                    "uniform highp int glEndWorkGroupID;                                                                                                                                           \n" +
                    "uniform highp int _workGroupSizeSquared;                                                                                                                                      \n" +
                    "uniform highp int glStartInvocationID;                                                                                                                                        \n" +
                    "uniform highp int glEndInvocationID;                                                                                                                                          \n" +
                    "uniform highp vec2 _bufferSizeVec2;                                                                                                                                           \n" +
                    "highp ivec2 _bufferSize = ivec2(0);                                                                                                                                           \n" +
                    "                                                                                                                                                                              \n" +
                    "void _executeWorkingGroup();                                                                                                                                                  \n" +
                    "                                                                                                                                                                              \n" +
                    "#ifdef GLES_VERTEX_SHADER                                                                                                                                                     \n" +
                    "                                                                                                                                                                              \n" +
                    "flat out highp vec4 _workGroupData0;                                                                                                                                          \n" +
                    "flat out highp ivec2 _outputCoord;                                                                                                                                            \n" +
                    "flat out highp int _workgroupID;                                                                                                                                              \n" +
                    "                                                                                                                                                                              \n" +
                    "void main()                                                                                                                                                                   \n" +
                    "{                                                                                                                                                                             \n" +
                    "    _bufferSize = ivec2(_bufferSizeVec2);                                                                                                                                     \n" +
                    "    glWorkGroupID = _workgroupID = (glStartWorkGroupID + gl_VertexID);                                                                                                        \n" +
                    "                                                                                                                                                                              \n" +
                    "    glLocalInvocationID = 0;                                                                                                                                                  \n" +
                    "    glGlobalInvocationID = (glWorkGroupID * glWorkGroupSize + glLocalInvocationID);                                                                                           \n" +
                    "    glNumInvocations = (glEndInvocationID - glStartInvocationID) + 1;                                                                                                         \n" +
                    "                                                                                                                                                                              \n" +
                    "    if(glGlobalInvocationID >= glStartInvocationID && glGlobalInvocationID <= glEndInvocationID) _executeWorkingGroup();                                                      \n" +
                    "    _workGroupData0 = glData[0];                                                                                                                                              \n" +
                    "                                                                                                                                                                              \n" +
                    "    gl_PointSize = float(_workGroupSizeSquared);                                                                                                                              \n" +
                    "    _outputCoord = ivec2((glWorkGroupID * _workGroupSizeSquared) % _bufferSize.x, gl_PointSize * floor(float(glWorkGroupID * _workGroupSizeSquared) / float(_bufferSize.x))); \n" +
                    "                                                                                                                                                                              \n" +
                    "    gl_Position = vec4(-1.0 + 2.0 * vec2(_outputCoord) / vec2(_bufferSize), 0.0, 1.0);                                                                                        \n" +
                    "    gl_Position.xy += vec2(gl_PointSize + 0.5) / vec2(_bufferSize);                                                                                                           \n" +
                    "}                                                                                                                                                                             \n" +
                    "                                                                                                                                                                              \n" +
                    "#undef glTangent                                                                                                                                                              \n" +
                    "#undef glBitangent                                                                                                                                                            \n" +
                    "#undef glAnimatedVertex                                                                                                                                                       \n" +
                    "#undef glAnimatedNormal                                                                                                                                                       \n" +
                    "#undef glAnimatedTangent                                                                                                                                                      \n" +
                    "#undef glAnimatedBitangent                                                                                                                                                    \n" +
                    "#undef glLastFrameAnimatedVertex                                                                                                                                              \n" +
                    "#undef glLastFrameAnimatedNormal                                                                                                                                              \n" +
                    "#undef glLastFrameAnimatedTangent                                                                                                                                              \n" +
                    "#undef glLastFrameAnimatedBitangent                                                                                                                                              \n" +
                    "                                                                                                                                                                              \n" +
                    "#define gl_Position  reserved_keyword                                                                                                                                         \n" +
                    "#define gl_PointSize reserved_keyword                                                                                                                                         \n" +
                    "#define glVertex     reserved_keyword                                                                                                                                         \n" +
                    "#define glNormal     reserved_keyword                                                                                                                                         \n" +
                    "#define glTexCoord   reserved_keyword                                                                                                                                         \n" +
                    "                                                                                                                                                                              \n" +
                    "#undef GLES_VERTEX_SHADER                                                                                                                                                     \n" +
                    "#endif                                                                                                                                                                        \n" +
                    "#ifdef GLES_FRAGMENT_SHADER                                                                                                                                                   \n" +
                    "                                                                                                                                                                              \n" +
                    "flat in highp vec4 _workGroupData0;                                                                                                                                           \n" +
                    "flat in highp ivec2 _outputCoord;                                                                                                                                             \n" +
                    "flat in highp int _workgroupID;                                                                                                                                               \n" +
                    "                                                                                                                                                                              \n" +
                    "out highp vec4 glFragData;                                                                                                                                                    \n" +
                    "                                                                                                                                                                              \n" +
                    "void main()                                                                                                                                                                   \n" +
                    "{                                                                                                                                                                             \n" +
                    "    highp ivec2 dataCoord = ivec2(gl_FragCoord.xy) - _outputCoord;                                                                                                            \n" +
                    "    highp int localOutputID = (dataCoord.x + dataCoord.y * _workGroupSizeSquared);                                                                                            \n" +
                    "                                                                                                                                                                              \n" +
                    "    glWorkGroupID = _workgroupID;                                                                                                                                             \n" +
                    "                                                                                                                                                                              \n" +
                    "    glLocalInvocationID = int(floor(float(localOutputID) / float(glInvocationSize)));                                                                                         \n" +
                    "    glGlobalInvocationID = (glWorkGroupID * glWorkGroupSize + glLocalInvocationID);                                                                                           \n" +
                    "    glNumInvocations = (glEndInvocationID - glStartInvocationID) + 1;                                                                                                         \n" +
                    "                                                                                                                                                                              \n" +
                    "    if(glLocalInvocationID >= glWorkGroupSize || glGlobalInvocationID < glStartInvocationID || glGlobalInvocationID > glEndInvocationID) discard;                             \n" +
                    "    else if(localOutputID > 0)                                                                                                                                                \n" +
                    "    {                                                                                                                                                                         \n" +
                    "        _executeWorkingGroup();                                                                                                                                               \n" +
                    "        glFragData = glData[localOutputID % glInvocationSize];                                                                                                                \n" +
                    "                                                                                                                                                                              \n" +
                    "    } else glFragData = _workGroupData0;                                                                                                                                      \n" +
                    "}                                                                                                                                                                             \n" +
                    "                                                                                                                                                                              \n" +
                    "#undef GLES_FRAGMENT_SHADER                                                                                                                                                   \n" +
                    "#endif                                                                                                                                                                        \n" +
                    "                                                                                                                                                                              \n" +
                    "#define GLES_COMPUTE_SHADER                                                                                                                                                   \n" +
                    "#define local_size(x) const int local_size = x;                                                                                                                               \n" +
                    "#define main() _executeWorkingGroup()                                                                                                                                         \n";
            
    let status = glProgram.prototype.compile.call(this);
    if(status)
    {
        this.__uniform_bufferSize           = this.createUniformVec2("_bufferSizeVec2");
        this.__uniform_startInvocationID    = this.createUniformInt("glStartInvocationID");
        this.__uniform_endInvocationID      = this.createUniformInt("glEndInvocationID");
        this.__uniform_startWorkGroupID     = this.createUniformInt("glStartWorkGroupID");
        this.__uniform_endWorkGroupID       = this.createUniformInt("glEndWorkGroupID");
        this.__uniform_nWorkGroups          = this.createUniformInt("glNumWorkGroups");
        this.__uniform_workGroupSize        = this.createUniformInt("glWorkGroupSize");
        this.__uniform_workGroupSizeSquared = this.createUniformInt("_workGroupSizeSquared");
    }

    return status;
}

glComputeProgram.prototype.__getHeader = function() {
    return this.__ctx.__shadingGlobalConstants + this.__header;
}

glComputeProgram.prototype.__getHeaderLines = function() {
    return this.__ctx.__shadingGlobalConstantsLineCount + 97;
}

glComputeProgram.prototype.setSource = function(computeShaderSource) {
    this.__vertexShaderSource = this.__fragmentShaderSource = computeShaderSource;
}

glComputeProgram.prototype.loadAsync = function(computeShaderPath, completionHandler)
{         
    let self = this;

    this.__vertexShaderName = this.__fragmentShaderName = "\"" + computeShaderPath + "\"";
   
    dispatchAsync( function()
    {                                 
        loadFileAsync(computeShaderPath, function(shaderSource)
        {
            if(self.__programID != null)
            {
                self.setSource(shaderSource[0]);
    
                let didCompile = self.compile();
                if(completionHandler != null) completionHandler(self, didCompile, (didCompile ? null : self.getLastError()));
            }
        }); 
    });
}

glComputeProgram.prototype.__dispatchRange = function(computeTextureData, startIndex, endIndex, workGroupSize, workGroupSizeSquared)
{    
    let nInvocations = (endIndex - startIndex + 1);
    
    if(this.__invocationSize != null && nInvocations > 0)
    {
        let gl = this.__ctx.getGL();

        let wasCullingEnabled = gl.isEnabled(gl.CULL_FACE);
        let wasDepthTestingEnabled = gl.isEnabled(gl.DEPTH_TEST);
        let lastActiveProgram = this.__ctx.getActiveProgram();
        let lastActiveFramebuffer = this.__ctx.getActiveFramebuffer();
            
        if(wasCullingEnabled) gl.disable(gl.CULL_FACE);
        if(wasDepthTestingEnabled) gl.disable(gl.DEPTH_TEST);
        
        this.__bind();
        
        let startWorkGroupID = Math.floor((startIndex * this.__invocationSize) / (workGroupSizeSquared * workGroupSizeSquared));
        let endWorkGroupID   = Math.ceil((endIndex    * this.__invocationSize) / (workGroupSizeSquared * workGroupSizeSquared)); 
        let nWorkGroups      = (endWorkGroupID - startWorkGroupID) + 1; 

        computeTextureData.__descriptor.size = Math.max((endIndex + 1), computeTextureData.__descriptor.size);
        computeTextureData.__framebuffer.bind(computeTextureData.__framebufferAttachment);
        computeTextureData.__invalidated = false;

        this.__uniform_nWorkGroups.set(nWorkGroups);
        this.__uniform_workGroupSize.set(workGroupSize);
        this.__uniform_endWorkGroupID.set(endWorkGroupID);
        this.__uniform_startWorkGroupID.set(startWorkGroupID);
        this.__uniform_workGroupSizeSquared.set(workGroupSizeSquared);
        this.__uniform_bufferSize.set(computeTextureData.getWidth(), computeTextureData.getHeight());
        this.__uniform_startInvocationID.set(startIndex);
        this.__uniform_endInvocationID.set(endIndex);
        
        this.__ctx.updateActiveProgram();                                                  
        this.__ctx.unbindVertexArray(); 
        
        gl.drawArrays(gl.POINTS, 0, nWorkGroups);

        this.__ctx.bindFramebuffer(lastActiveFramebuffer);
        this.__ctx.bindProgram(lastActiveProgram);
        
        if(wasDepthTestingEnabled) gl.enable(gl.DEPTH_TEST);
        if(wasCullingEnabled) gl.enable(gl.CULL_FACE);
    }
}

glComputeProgram.prototype.dispatchRange = function(computeTextureData, startIndex, nInvocations, nInvocationsPerWorkGroup)
{
    if(this.__invocationSize != null && nInvocations > 0)
    {
        if(nInvocationsPerWorkGroup == null) nInvocationsPerWorkGroup = 1;

        let endIndex = (startIndex + nInvocations - 1);   
        computeTextureData.reserve(this.__invocationSize, (endIndex + 1), nInvocationsPerWorkGroup);

        this.__dispatchRange(computeTextureData, startIndex, endIndex, computeTextureData.__descriptor.workGroupSize, computeTextureData.__descriptor.workGroupSizeSquared)
    }
}

glComputeProgram.prototype.dispatch = function(computeTextureData, nInvocations, nInvocationsPerWorkGroup) {   
    this.dispatchRange(computeTextureData, 0, nInvocations, nInvocationsPerWorkGroup);
}

glComputeProgram.prototype.bind = null;
glComputeProgram.prototype.unbind = null;
glComputeProgram.prototype.runPostProcess = null;
