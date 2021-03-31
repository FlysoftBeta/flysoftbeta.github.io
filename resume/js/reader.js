var options = {
    cover: true,
	file: "https://cdn.jsdelivr.net/gh/FlysoftBeta/assets/file.bin"
}
var current = 0;
var pdf;
var pages = 0;
function getvar(name) {
    var query = window.location.search.substring(1);
    var vars = query.split("&");
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split("=");
        if (pair[0] == name) {
            return pair[1];
        }
    }
    return false;
}
function encrypt(str, pwd) {
    str = escape(str);
    pwd = escape(pwd);
    var prand = "";
    for (var I = 0; I < pwd.length; I++) {
        prand += pwd.charCodeAt(I).toString();
    }
    var sPos = Math.floor(prand.length / 5);
    var mult = parseInt(prand.charAt(sPos) + prand.charAt(sPos * 2) + prand.charAt(sPos * 3) + prand.charAt(sPos * 4) + prand.charAt(sPos * 5));
    var incr = Math.ceil(pwd.length / 2);
    var modu = Math.pow(2, 31) - 1;
    if (mult < 2) {
        return;
    }
    var salt = Math.round(Math.random() * 1000000000) % 100000000;
    prand += salt;
    while (prand.length > 10) {
        prand = (parseInt(prand.substring(0, 10)) + parseInt(prand.substring(10, prand.length))).toString();
    }
    prand = (mult * prand + incr) % modu;
    var enc_chr = "";
    var enc_str = "";
    for (var I = 0; I < str.length; I++) {
        enc_chr = parseInt(str.charCodeAt(I) ^ Math.floor((prand / modu) * 255));
        if (enc_chr < 16) {
            enc_str += "0" + enc_chr.toString(16);
        } else
            enc_str += enc_chr.toString(16);
        prand = (mult * prand + incr) % modu;
    }
    salt = salt.toString(16);
    while (salt.length < 8)
        salt = "0" + salt;
    enc_str += salt;
    return enc_str;
}
function decrypt(str, pwd) {
    pwd = escape(pwd);
    var prand = "";
    for (var I = 0; I < pwd.length; I++) {
        prand += pwd.charCodeAt(I).toString();
    }
    var sPos = Math.floor(prand.length / 5);
    var mult = parseInt(prand.charAt(sPos) + prand.charAt(sPos * 2) + prand.charAt(sPos * 3) + prand.charAt(sPos * 4) + prand.charAt(sPos * 5));
    var incr = Math.round(pwd.length / 2);
    var modu = Math.pow(2, 31) - 1;
    var salt = parseInt(str.substring(str.length - 8, str.length), 16);
    str = str.substring(0, str.length - 8);
    prand += salt;
    while (prand.length > 10) {
        prand = (parseInt(prand.substring(0, 10)) + parseInt(prand.substring(10, prand.length))).toString();
    }
    prand = (mult * prand + incr) % modu;
    var enc_chr = "";
    var enc_str = "";
    for (var I = 0; I < str.length; I += 2) {
        enc_chr = parseInt(parseInt(str.substring(I, I + 2), 16) ^ Math.floor((prand / modu) * 255));
        enc_str += String.fromCharCode(enc_chr);
        prand = (mult * prand + incr) % modu;
    }
    return unescape(enc_str);
}
function play_ani() {
    document.querySelector(".loading").style.display = "none";
    document.querySelector(".loading").removeEventListener("webkitTransitionEnd", play_ani);
}
function prev() {
    if (pages != 0) {
        if (current != 1) {
            if (options.cover == true) {
                if (current == 2) {
                    setpage(1);
                } else {
                    setpage(current - 2);
                }
            } else {
                setpage(current - 2);
            }
        }
    }
}
function next() {
    if (pages != 0) {
        if (options.cover == true) {
            if (current != pages) {
                if (current == 1) {
                    setpage(2);
                } else if (current != pages) {
                    setpage(current + 2);
                }
            }
        } else {
            if (current + 2 <= pages)
                setpage(current + 2);
        }
    }
}
function setpage(newpage) {
    if (pages != 0) {
        current = newpage;
        document.querySelector(".page-display").innerText = ((options.cover) ? ((newpage == 1) ? "Cover" : ((newpage == pages) ? "Back" : newpage - 1)) : newpage) + "/" + ((options.cover) ? pages - 2 : pages);
        var render_reset = function() {
            document.querySelector("#render1").remove();
            document.querySelector("#render2").remove();
            var render1 = document.createElement("canvas");
            var render2 = document.createElement("canvas");
            render1.id = "render1";
            render2.id = "render2";
            document.querySelector(".render").appendChild(render1);
            document.querySelector(".render").appendChild(render2);
        }
        var render_func = function(page) {
            var viewport = page.getViewport({
                scale: 1
            });
            var scaled = page.getViewport({
                scale: document.body.scrollWidth / viewport.width / 2 * 0.5
            });
            var viewscaled = page.getViewport({
                scale: document.body.scrollWidth / viewport.width
            });
            var canvas;
            if (options.cover == true) {
                if (page.pageNumber != 1) {
                    if (page.pageNumber % 2 == 0) {
                        canvas = document.querySelector("#render1");
                    } else {
                        canvas = document.querySelector("#render2");
                    }
                } else {
                    canvas = document.querySelector("#render1");
                }
            } else {
                if (page.pageNumber % 2 != 0) {
                    canvas = document.querySelector("#render1");
                } else {
                    canvas = document.querySelector("#render2");
                }
            }
            var context = canvas.getContext("2d");
            canvas.height = viewscaled.height;
            canvas.width = viewscaled.width;
            var renderContext = {
                canvasContext: context,
                viewport: viewscaled
            };
            page.render(renderContext).promise.then(function() {
                console.log("Page rendered.");
            });
        }
        if (options.cover == true) {
            if (newpage == 1) {
                render_reset();
                document.querySelector("#render1").style.float = "none";
                document.querySelector("#render2").style.display = "none";
                pdf.getPage(newpage).then(render_func);
                return;
            }
            if (newpage == pages) {
                render_reset();
                document.querySelector("#render1").style.float = "none";
                document.querySelector("#render2").style.display = "none";
                pdf.getPage(newpage).then(render_func);
                return;
            }
        }
        render_reset();
        pdf.getPage(newpage).then(render_func);
        if (newpage + 1 <= pages) {
            pdf.getPage(newpage + 1).then(render_func);
        }
    }
}
window.onresize = function() {
    if (pages != 0) {
        setpage(current);
    }
}
window.onload = function() {
    var pass = getvar("t");
    if (pass == false) {
        throw "no token error";
    }
    pdfjsLib.GlobalWorkerOptions.workerSrc = "./js/pdf.worker.js";
    fetch(options.file, {
        method: "GET",
        headers: new Headers()
    }).then(response=>response.text()).then(((data)=>{
        data = decrypt(data, pass);
        if (data == undefined) {
            throw "invalid token error";
        }
        var doc = pdfjsLib.getDocument(data);
        doc.promise.then(function(pdfobj) {
            pdf = pdfobj;
            pages = pdf.numPages;
            if (options.cover == true && pdf.numPages % 2 != 0) {
                throw "invalid token error";
            }
            if (pages != 0) {
                setpage(1);
            }
        });
        setTimeout(function() {
            document.querySelector(".loading").addEventListener("webkitTransitionEnd", play_ani);
            document.querySelector(".loading").classList.add("loaded");
        }, 1000);
    }
    )).catch(((Var_Error)=>{
        console.log("Cannot fetch from server!");
    }
    ));
}