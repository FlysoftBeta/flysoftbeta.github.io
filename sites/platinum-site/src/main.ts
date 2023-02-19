import "./style.css";
import { reload as reloadLang } from "./language.js";
import { loadAll as loadSVGs } from "./svgLoader.js";
import { load as loadBtns } from "./liveButton.js";
import { FSDownloadProvider, getURL } from "./updateProvider";

interface UpdateInfo {
    version: string;
    hash: string;
    provider: FSDownloadProvider;
}

let downloading = false;

async function fetchData(platform: string, arch: string, channels: Array<string>) {
    let data: Record<string, UpdateInfo> = {};
    for (let i = 0; i < channels.length; i++) {
        const channel = channels[i];
        try {
            data[channel] = await (
                await fetch(
                    "https://flysoftbeta.cn/update/platinum/" +
                        channels[i] +
                        "_" +
                        platform +
                        "_" +
                        arch +
                        ".json",
                    {
                        headers: {
                            "Cache-Control": "no-cache",
                        },
                    }
                )
            ).json();
        } catch (error) {
            console.error("Fetch error: " + error);
        }
    }
    return data;
}

async function startDownload(platform: string, arch: string) {
    if (downloading) return;
    downloading = true;
    document.querySelector<HTMLElement>("#started")?.classList.add("dialog_show");
    let data = await fetchData(platform, arch, ["preview", "latest"]);
    let provider;
    if (data["latest"]) provider = data["latest"]["provider"];
    else if (data["preview"]) provider = data["preview"]["provider"];
    else {
        alert("An error occurred. See console for more details.");
        downloading = false;
        console.error("Cannot fetch any update info");
        return;
    }
    console.log("Got provider: " + JSON.stringify(provider));
    let dlURL = await getURL(provider);
    console.log("Download url: " + dlURL);
    var a = document.createElement("a");
    a.href = dlURL;
    a.download = "";
    a.click();
    downloading = false;
    return true;
}

window.addEventListener("scroll", () => {
    let cover = <HTMLElement>document.querySelector("#cover");
    let translateY = window.scrollY / 3;
    cover.style.transform = "translateY(" + translateY.toString() + "px)";
    let opacity = 1 - window.scrollY / 1000;
    if (opacity < 0) opacity = 0;
    cover.style.opacity = opacity.toString();
});

window.addEventListener("DOMContentLoaded", () => {
    document.body.classList.add("transition");

    loadBtns();
    loadSVGs();
    reloadLang();

    document
        .querySelector<HTMLButtonElement>("#download_windows")
        ?.addEventListener("click", () => {
            startDownload("win32", "all");
        });
    document
        .querySelector<HTMLButtonElement>("#download_linux")
        ?.addEventListener("click", () => {
            startDownload("linux", "x64");
        });
    document
        .querySelector<HTMLButtonElement>("#download_msstore")
        ?.addEventListener("click", () => {
            window.open(
                "https://www.microsoft.com/store/productId/9N5S8XGW37NB",
                "_blank"
            );
        });
    document
        .querySelector<HTMLButtonElement>("#download_qq")
        ?.addEventListener("click", () => {
            window.open("https://jq.qq.com/?_wv=1027&k=dSltpsZ0", "_blank");
        });
    document
        .querySelector<HTMLButtonElement>("#started_close")
        ?.addEventListener("click", () => {
            document.querySelector("#started")?.classList.remove("dialog_show");
        });

    fetchData("win32", "all", ["preview", "latest"]).then((data) => {
        (<HTMLElement>document.querySelector("#dev_latest")).innerText = data["latest"]
            ? data["latest"]["version"]
            : "No data";
        (<HTMLElement>document.querySelector("#dev_preview")).innerText =
            data["preview"] && !data["preview"]["version"].endsWith("pre.999")
                ? data["preview"]["version"]
                : "No data";
    });
});
