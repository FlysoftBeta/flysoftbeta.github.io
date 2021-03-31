window.onload = function() {
    var dragtext = "Drag file here/将文件拖拽到这里";
    var loadtext = "Converting/转换中";
    var copytext = "Copied/已复制";
    document.querySelector(".loading div").innerText = dragtext;
    var stop = function(event) {
        event.preventDefault();
        event.stopPropagation();
    }
    window.addEventListener("dragenter", stop);
    window.addEventListener("dragover", stop);
    window.addEventListener("dragleave", stop);
    window.addEventListener("drop", function() {
        document.querySelector(".loading div").innerText = loadtext;
        var file;
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer.items != undefined) {
            for (var i = 0; i < event.dataTransfer.items.length; i++) {
                if (event.dataTransfer.items[i].kind == "file" && event.dataTransfer.items[i].webkitGetAsEntry().isFile) {
                    file = event.dataTransfer.items[i].getAsFile();
                }
            }
        }
        var pdf = new FileReader();
        pdf.onload = function(event) {
            document.querySelector(".loading div").innerText = event.target.result;
        }
        pdf.readAsDataURL(file);
    });
}