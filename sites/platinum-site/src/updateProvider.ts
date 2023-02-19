export interface FSDownloadProvider {
    shareKey: string;
    sharePwd: string;
    folder: string;
    file: string;
}

async function getData(provider: FSDownloadProvider, parent = "0", page = 0) {
    let url =
        "https://fs-my-proxy.vercel.app/api/?method=GET&url=" +
        encodeURIComponent(
            "https://www.123pan.com/api/share/get?Page=1&limit=1000&next=" +
                page +
                "&orderBy=share_id&orderDirection=desc&shareKey=" +
                provider.shareKey +
                "&SharePwd=" +
                provider.sharePwd +
                "&ParentFileId=" +
                parent
        );
    let response = await (await fetch(url, { method: "POST" })).json();
    if (response["code"] != 0)
        throw new Error("Request " + url + " failed: " + JSON.stringify(response));
    return response["data"]["InfoList"];
}

function getFileObject(data: any[], fileName: string) {
    for (let i = 0; i < data.length; i++) {
        if (data[i]["FileName"].toUpperCase() == fileName.toUpperCase()) {
            return data[i];
        }
    }
    return null;
}

async function getDownloadURL(file: any, provider: FSDownloadProvider) {
    let url =
        "https://fs-my-proxy.vercel.app/api/?method=POST&url=" +
        encodeURIComponent("https://www.123pan.com/a/api/share/download/info") +
        "&cookie=" +
        encodeURIComponent(
            "shareKey=" + provider.shareKey + "; SharePwd=" + provider.sharePwd
        ) +
        "&content_type=" +
        encodeURIComponent("application/json;charset=utf-8") +
        "&body=" +
        encodeURIComponent(
            JSON.stringify({
                Etag: file.Etag,
                FileID: file.FileId,
                S3keyFlag: file.S3KeyFlag,
                ShareKey: provider.shareKey,
                Size: file.Size,
            })
        );
    let response = await (
        await fetch(url, {
            method: "POST",
        })
    ).json();
    if (response["code"] != 0)
        throw new Error("Request " + url + " failed: " + JSON.stringify(response));
    return response["data"]["DownloadURL"];
}

export async function getURL(provider: FSDownloadProvider) {
    let folderObj = getFileObject(await getData(provider), provider.folder);
    if (!folderObj) throw new Error("Cannot find folder: " + provider.folder);
    let folderID = folderObj["FileId"];
    let fileObj = getFileObject(await getData(provider, folderID), provider.file);
    if (!fileObj) throw new Error("Cannot find file: " + provider.file);
    let fileURL = atob(
        new URL(await getDownloadURL(fileObj, provider)).searchParams.get("params")!
    );
    return fileURL;
}
