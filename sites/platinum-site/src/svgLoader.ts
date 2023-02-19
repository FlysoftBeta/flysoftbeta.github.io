import "./svgLoader.css";

export async function load(element: HTMLElement) {
    let url = element.dataset.url;
    if (!url) return;
    element.innerHTML = await (await fetch(url.replace("dirname", "/.."))).text();
    element.dataset.loaded = "true";
}

export async function loadAll() {
    var svgs = document.querySelectorAll('.svg_loader:not([data-loaded="true"])');
    for (var i = 0; i < svgs.length; i++) {
        await load(<HTMLElement>svgs.item(i));
    }
}
