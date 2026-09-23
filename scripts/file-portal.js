const filePortal = document.querySelector("[data-file-portal]");

if (filePortal) {
  const endpoint = "/.netlify/functions/file-portal";
  const locale = document.documentElement.lang === "en" ? "en" : "no";
  const messages = {
    no: {
      signIn: "Åpne filportalen",
      invalidPassword: "Passordet ble ikke godkjent.",
      selectFile: "Velg en fil før du starter.",
      fileTooLarge: "Velg en fil på maksimalt 100 MB.",
      uploading: "Laster opp",
      complete: "Filen er klar. Kopiér lenken og send den til kunden.",
      failed: "Opplastingen kunne ikke fullføres. Prøv på nytt.",
      deleting: "Sletter fil…",
      deleted: "Filen og nedlastingslenken er slettet.",
      copy: "Kopier lenke",
      copied: "Lenken er kopiert",
      delete: "Slett",
      download: "Last ned fil",
      preparing: "Forbereder nedlasting",
      downloading: "Laster ned",
      downloadFailed: "Nedlastingen kunne ikke fullføres. Prøv igjen eller be avsenderen om en ny lenke.",
      unavailable: "Denne filen er ikke lenger tilgjengelig.",
      noFiles: "Ingen aktive filer.",
      expires: "Tilgjengelig til",
      size: "Filstørrelse",
    },
    en: {
      signIn: "Open file portal",
      invalidPassword: "The password was not accepted.",
      selectFile: "Choose a file before starting.",
      fileTooLarge: "Choose a file up to 100 MB.",
      uploading: "Uploading",
      complete: "The file is ready. Copy the link and send it to the customer.",
      failed: "The upload could not be completed. Please try again.",
      deleting: "Deleting file…",
      deleted: "The file and download link have been deleted.",
      copy: "Copy link",
      copied: "Link copied",
      delete: "Delete",
      download: "Download file",
      preparing: "Preparing download",
      downloading: "Downloading",
      downloadFailed: "The download could not be completed. Please try again or ask the sender for a new link.",
      unavailable: "This file is no longer available.",
      noFiles: "No active files.",
      expires: "Available until",
      size: "File size",
    },
  }[locale];

  const formatBytes = (bytes) => {
    if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  };

  const formatDate = (value) =>
    new Intl.DateTimeFormat(locale === "no" ? "nb-NO" : "en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(value));

  const request = async (action, { method = "GET", token, body, params } = {}) => {
    const url = new URL(endpoint, window.location.origin);
    url.searchParams.set("action", action);
    Object.entries(params || {}).forEach(([key, value]) => url.searchParams.set(key, value));
    const headers = {};
    if (token) headers["x-file-portal-token"] = token;
    if (body && !(body instanceof ArrayBuffer)) headers["Content-Type"] = "application/json";

    const response = await fetch(url, {
      method,
      headers,
      body: body instanceof ArrayBuffer ? body : body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Request failed (${response.status})`);
    }
    return response;
  };

  const setStatus = (element, text, type = "") => {
    if (!element) return;
    element.hidden = !text;
    element.textContent = text || "";
    element.classList.remove("is-error", "is-success");
    if (type) element.classList.add(type === "error" ? "is-error" : "is-success");
  };

  if (filePortal.dataset.filePortal === "admin") {
    const loginForm = filePortal.querySelector("[data-file-login]");
    const uploadPanel = filePortal.querySelector("[data-file-upload]");
    const uploadForm = filePortal.querySelector("[data-file-upload-form]");
    const fileInput = filePortal.querySelector("[data-file-input]");
    const uploadButton = filePortal.querySelector("[data-upload-button]");
    const progress = filePortal.querySelector("[data-upload-progress]");
    const progressText = filePortal.querySelector("[data-upload-progress-text]");
    const status = filePortal.querySelector("[data-file-status]");
    const result = filePortal.querySelector("[data-file-result]");
    const resultLink = filePortal.querySelector("[data-file-result-link]");
    const fileList = filePortal.querySelector("[data-file-list]");
    let adminToken = "";

    const showFile = (file) => {
      const item = document.createElement("article");
      item.className = "file-portal__file";
      const details = document.createElement("div");
      const title = document.createElement("h3");
      title.textContent = file.filename;
      const meta = document.createElement("p");
      meta.textContent = `${formatBytes(file.size)} · ${messages.expires} ${formatDate(file.expiresAt)}`;
      details.append(title, meta);

      const actions = document.createElement("div");
      actions.className = "file-portal__file-actions";
      const copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.className = "button button--secondary button--compact";
      copyButton.textContent = messages.copy;
      copyButton.addEventListener("click", async () => {
        await navigator.clipboard.writeText(file.shareUrl);
        copyButton.textContent = messages.copied;
        setTimeout(() => {
          copyButton.textContent = messages.copy;
        }, 1800);
      });
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "file-portal__delete";
      deleteButton.textContent = messages.delete;
      deleteButton.addEventListener("click", async () => {
        deleteButton.disabled = true;
        setStatus(status, messages.deleting);
        try {
          await request("delete", { method: "POST", token: adminToken, body: { file: file.id } });
          item.remove();
          if (!fileList.children.length) fileList.textContent = messages.noFiles;
          setStatus(status, messages.deleted, "success");
        } catch (error) {
          setStatus(status, error.message, "error");
          deleteButton.disabled = false;
        }
      });
      actions.append(copyButton, deleteButton);
      item.append(details, actions);
      return item;
    };

    const loadFiles = async () => {
      const response = await request("list", { token: adminToken });
      const { files } = await response.json();
      fileList.replaceChildren();
      if (!files.length) {
        fileList.textContent = messages.noFiles;
        return;
      }
      files.forEach((file) => fileList.append(showFile(file)));
    };

    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const password = new FormData(loginForm).get("password")?.toString() || "";
      const button = loginForm.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        adminToken = password;
        await loadFiles();
        loginForm.hidden = true;
        uploadPanel.hidden = false;
        setStatus(status, "");
      } catch (error) {
        adminToken = "";
        setStatus(status, error.message || messages.invalidPassword, "error");
      } finally {
        button.disabled = false;
      }
    });

    uploadForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const file = fileInput.files?.[0];
      if (!file) {
        setStatus(status, messages.selectFile, "error");
        return;
      }
      if (file.size > 100 * 1024 * 1024) {
        setStatus(status, messages.fileTooLarge, "error");
        return;
      }

      const expiryDays = Number(new FormData(uploadForm).get("expiryDays"));
      uploadButton.disabled = true;
      progress.hidden = false;
      result.hidden = true;
      setStatus(status, "");

      try {
        const start = await request("start", {
          method: "POST",
          token: adminToken,
          body: {
            filename: file.name,
            size: file.size,
            mime: file.type,
            expiryDays,
            downloadPath: filePortal.dataset.downloadPath,
          },
        });
        const session = await start.json();

        for (let index = 0; index < session.totalChunks; index += 1) {
          const offset = index * session.chunkSize;
          const chunk = await file.slice(offset, offset + session.chunkSize).arrayBuffer();
          await request("chunk", {
            method: "POST",
            token: adminToken,
            body: chunk,
            params: { file: session.id, index },
          });
          const percent = Math.round(((index + 1) / session.totalChunks) * 100);
          progress.value = percent;
          progressText.textContent = `${messages.uploading} ${index + 1} / ${session.totalChunks} (${percent} %)`;
        }

        const complete = await request("finalize", {
          method: "POST",
          token: adminToken,
          body: { file: session.id },
        });
        const { file: sharedFile, shareUrl } = await complete.json();
        resultLink.value = shareUrl;
        result.hidden = false;
        uploadForm.reset();
        progress.hidden = true;
        setStatus(status, messages.complete, "success");
        await loadFiles();
        result.querySelector("[data-copy-new-link]").onclick = async () => {
          await navigator.clipboard.writeText(shareUrl);
          setStatus(status, messages.copied, "success");
        };
        void sharedFile;
      } catch (error) {
        progress.hidden = true;
        setStatus(status, error.message || messages.failed, "error");
      } finally {
        uploadButton.disabled = false;
      }
    });
  }

  if (filePortal.dataset.filePortal === "download") {
    const status = filePortal.querySelector("[data-download-status]");
    const downloadButton = filePortal.querySelector("[data-download-button]");
    const fileName = filePortal.querySelector("[data-download-name]");
    const fileMeta = filePortal.querySelector("[data-download-meta]");
    const params = new URLSearchParams(window.location.search);
    const file = params.get("file");
    const token = params.get("token");
    let manifest;

    const loadManifest = async () => {
      if (!file || !token) throw new Error(messages.unavailable);
      const response = await request("download-manifest", { params: { file, token } });
      const data = await response.json();
      return data.file;
    };

    const download = async () => {
      downloadButton.disabled = true;
      const chunks = [];
      try {
        for (let index = 0; index < manifest.totalChunks; index += 1) {
          setStatus(status, `${messages.downloading} ${index + 1} / ${manifest.totalChunks}`);
          const response = await request("download-chunk", { params: { file, token, index } });
          chunks.push(await response.arrayBuffer());
        }
        const objectUrl = URL.createObjectURL(new Blob(chunks, { type: manifest.mime }));
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = manifest.filename;
        document.body.append(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objectUrl);
        setStatus(status, "", "success");
      } catch (error) {
        setStatus(status, error.message || messages.downloadFailed, "error");
        downloadButton.disabled = false;
      }
    };

    downloadButton.addEventListener("click", download);
    setStatus(status, messages.preparing);
    loadManifest()
      .then((data) => {
        manifest = data;
        fileName.textContent = data.filename;
        fileMeta.textContent = `${messages.size}: ${formatBytes(data.size)} · ${messages.expires} ${formatDate(data.expiresAt)}`;
        downloadButton.hidden = false;
        setStatus(status, "");
      })
      .catch((error) => {
        setStatus(status, error.message || messages.unavailable, "error");
      });
  }
}
