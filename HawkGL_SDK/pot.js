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

function nextPot(x)
{
	--x;
	
	x |= x >> 1;
	x |= x >> 2;
	x |= x >> 4;
	x |= x >> 8;
	x |= x >> 16;
	
	return ++x;
}

function prevPot(x)
{
    x = x | (x >> 1);
    x = x | (x >> 2);
    x = x | (x >> 4);
    x = x | (x >> 8);
    x = x | (x >> 16);
    
    return x - (x >> 1);
}

function closestPot(x)
{
	let lp2 = prevPot(x);
	let np2 = nextPot(x);
	
	return (((np2 - x) < (x - lp2)) ? np2 : lp2);
}
