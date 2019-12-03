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

let HawkGL_SDK_version = 1.0;

let HawkGL_SDK_absolutePath = "";
let HawkGL_SDK_relativePath = "";

(function()
{    
    function includeScriptSDK(fileName, onLoad) {
        document.write("<script src='" + HawkGL_SDK_absolutePath + fileName + "?version=" + HawkGL_SDK_version + "' onload='" + ((onLoad != null) ? ("(" + onLoad.toString() + ")();") : "") + "'></script>");
    }
    
    function getRootDomain()
    {
        let parts = document.location.href.split('/');
        parts[parts.length - 1] = '';
    
        return parts.join('/');
    }

    function getRootSDK()
    {
        let scripts = document.getElementsByTagName('script');
        let pathSDK = scripts[scripts.length - 1].src.split('?')[0];
        let rootSDK = pathSDK.split('/').slice(0, -1).join('/') + '/';
        
        return rootSDK;
    }

    HawkGL_SDK_absolutePath = getRootSDK();
    HawkGL_SDK_relativePath = HawkGL_SDK_absolutePath.replace(getRootDomain(), "");

    includeScriptSDK("dialogManager.js", function()
    {
        DialogManager.alertIcon   = HawkGL_SDK_absolutePath + "Resources/Icons/icon_info.png";
        DialogManager.errorIcon   = HawkGL_SDK_absolutePath + "Resources/Icons/icon_error.png";
        DialogManager.warningIcon = HawkGL_SDK_absolutePath + "Resources/Icons/icon_warning.png";
        DialogManager.confirmIcon = HawkGL_SDK_absolutePath + "Resources/Icons/icon_question.png";
    });

    includeScriptSDK("K3D.js");
    includeScriptSDK("pot.js");
    includeScriptSDK("task.js");
    includeScriptSDK("dispatch.js");
    includeScriptSDK("fpsCounter.js");
    includeScriptSDK("fileManager.js");
    includeScriptSDK("progressMeter.js");
    includeScriptSDK("CCapture.all.min.js");
    
    includeScriptSDK("gl/glVector2f.js");
    includeScriptSDK("gl/glVector3f.js");
    includeScriptSDK("gl/glVector4f.js");
    includeScriptSDK("gl/glMatrix4x4f.js");
    includeScriptSDK("gl/glQuaternion.js");
    
    includeScriptSDK("parserGLTF.js");
    
    includeScriptSDK("gl/glContext.js");
    includeScriptSDK("gl/glAABB.js");
    includeScriptSDK("gl/glCamera.js");
    includeScriptSDK("gl/glVertex.js");
    includeScriptSDK("gl/glBuffer.js");
    includeScriptSDK("gl/glPrimitive.js");
    includeScriptSDK("gl/glMesh.js");
    includeScriptSDK("gl/glUniform.js");
    includeScriptSDK("gl/glProgram.js");
    includeScriptSDK("gl/glTexture.js");
    includeScriptSDK("gl/glFramebuffer.js");
    includeScriptSDK("gl/glEnvironmentMap.js");

})();