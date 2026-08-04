import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, Trash2, Upload } from "lucide-react";

const session = () => JSON.parse(localStorage.getItem("ln_session") || "null");
const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${session()?.token}`,
});
const api = async (url: string, opt: any = {}) => {
  const r = await fetch(url, { ...opt, headers: headers() });
  const x = r.status === 204 ? null : await r.json().catch(() => null);
  if (!r.ok) throw new Error(x?.error || "Request failed");
  return x;
};
const readImageData = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read photo"));
    reader.readAsDataURL(blob);
  });
const imageData = async (file: File) => {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw new Error("Choose a PNG, JPEG, or WebP photo");
  if (file.size <= 2 * 1024 * 1024) return readImageData(file);
  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = source;
    await image.decode();
    const scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare camera photo");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const compressed = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82),
    );
    if (!compressed || compressed.size > 2 * 1024 * 1024)
      throw new Error("Could not resize photo below 2 MB");
    return readImageData(compressed);
  } finally {
    URL.revokeObjectURL(source);
  }
};

function SelfPhotoCard() {
  const [input, setInput] = useState<HTMLInputElement | null>(null),
    [cameraInput, setCameraInput] = useState<HTMLInputElement | null>(null),
    [avatar, setAvatar] = useState<string | null>(null),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api("/api/me/avatar")
      .then((x) => setAvatar(x.avatarUrl))
      .catch((e) => setNotice(e.message));
  }, []);
  const upload = async (file?: File) => {
    if (!file) return;
    try {
      setBusy(true);
      const dataUrl = await imageData(file),
        x = await api("/api/me/avatar", {
          method: "POST",
          body: JSON.stringify({ dataUrl }),
        });
      setAvatar(x.avatarUrl);
      const s = session();
      localStorage.setItem(
        "ln_session",
        JSON.stringify({ ...s, user: { ...s.user, avatarUrl: x.avatarUrl } }),
      );
      setNotice("Profile photo updated");
    } catch (e: any) {
      setNotice(e.message);
    } finally {
      setBusy(false);
      if (input) input.value = "";
      if (cameraInput) cameraInput.value = "";
    }
  };
  const remove = async () => {
    try {
      setBusy(true);
      await api("/api/me/avatar", { method: "DELETE" });
      setAvatar(null);
      const s = session();
      localStorage.setItem(
        "ln_session",
        JSON.stringify({ ...s, user: { ...s.user, avatarUrl: null } }),
      );
      setNotice("Profile photo removed");
    } catch (e: any) {
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  };
  const initials = session()
    ?.user.name.split(" ")
    .map((x: string) => x[0])
    .slice(0, 2)
    .join("");
  return (
    <div className="panel settingsCard avatarSettingsCard">
      <div className="settingsHead">
        <span>
          <Camera />
        </span>
        <div>
          <h2>Profile photo</h2>
          <p>Take a new photo or upload one from your device.</p>
        </div>
      </div>
      <div className="selfAvatarEditor">
        <div className="largeAvatar">
          {avatar ? <img src={avatar} alt="Profile photo" /> : initials}
        </div>
        <div>
          <input
            ref={setInput}
            hidden
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => upload(e.target.files?.[0])}
          />
          <input
            ref={setCameraInput}
            hidden
            type="file"
            accept="image/*"
            capture="user"
            onChange={(e) => upload(e.target.files?.[0])}
          />
          <button
            className="photoPrimary"
            type="button"
            disabled={busy}
            onClick={() => cameraInput?.click()}
          >
            <Camera />
            {busy ? "Uploading…" : "Take photo"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => input?.click()}
          >
            <Upload />
            {avatar ? "Change photo" : "Upload photo"}
          </button>
          {avatar && (
            <button
              className="photoRemove"
              type="button"
              disabled={busy}
              onClick={remove}
            >
              <Trash2 />
              Remove
            </button>
          )}
          <small>Camera, PNG, JPEG or WebP · large photos are resized automatically</small>
        </div>
      </div>
      {notice && <p className="photoNotice">{notice}</p>}
    </div>
  );
}

export function SelfAvatarTools() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    let mount: HTMLElement | null = null;
    const attach = () => {
      if (mount) return;
      const grid = document.querySelector<HTMLElement>(".readerSettingsGrid");
      if (!grid) return;
      mount = document.createElement("div");
      mount.className = "selfAvatarMount";
      grid.prepend(mount);
      setHost(mount);
      observer.disconnect();
    };
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    attach();
    return () => {
      observer.disconnect();
      mount?.remove();
    };
  }, []);
  return host ? createPortal(<SelfPhotoCard />, host) : null;
}

type AvatarMap = Record<string, string | null>;
type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
  department?: { name: string } | null;
};
export function AdminAvatarTools() {
  const [avatars, setAvatars] = useState<AvatarMap>({}),
    [editor, setEditor] = useState<{
      user: AdminUser;
      host: HTMLElement;
    } | null>(null),
    usersRef = useRef<AdminUser[]>([]),
    avatarsRef = useRef<AvatarMap>({}),
    editorHostRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    let observer: MutationObserver | null = null;
    Promise.all([api("/api/admin/accounts"), api("/api/admin/avatars")])
      .then(([users, photos]) => {
        usersRef.current = users;
        avatarsRef.current = Object.fromEntries(
          photos.map((x: any) => [x.id, x.avatarUrl]),
        );
        setAvatars(avatarsRef.current);
        const scan = () => {
          document
            .querySelectorAll<HTMLElement>(".accountRow:not(.accountHeader)")
            .forEach((row) => {
              const user = usersRef.current.find((u) =>
                row.textContent?.includes(u.email),
              );
              if (!user) return;
              const avatar = row.querySelector<HTMLElement>(".avatar"),
                url = avatarsRef.current[user.id];
              if (avatar) {
                avatar.style.backgroundImage = url ? `url(${url})` : "";
                avatar.classList.toggle("hasPhoto", !!url);
              }
            });
          const modal = document.querySelector<HTMLElement>(".accountEditor");
          const email = modal?.querySelector<HTMLInputElement>(
            'input[type="email"]',
          )?.value;
          const user = usersRef.current.find((u) => u.email === email);
          if (modal && user) {
            let host = modal.querySelector<HTMLElement>(
              ".adminEditorPhotoMount",
            );
            if (!host) {
              host = document.createElement("div");
              host.className = "adminEditorPhotoMount";
              modal.querySelector(".modalHead")?.after(host);
            }
            if (host && editorHostRef.current !== host) {
              editorHostRef.current = host;
              setEditor({ user, host });
            }
          } else if (editorHostRef.current) {
            editorHostRef.current = null;
            setEditor(null);
          }
        };
        scan();
        observer = new MutationObserver(() => queueMicrotask(scan));
        observer.observe(document.body, { childList: true, subtree: true });
      })
      .catch(() => {});
    return () => observer?.disconnect();
  }, []);
  const changed = (id: string, url: string | null) => {
    avatarsRef.current = { ...avatarsRef.current, [id]: url };
    setAvatars(avatarsRef.current);
    document
      .querySelectorAll<HTMLElement>(".accountRow:not(.accountHeader)")
      .forEach((row) => {
        if (
          !row.textContent?.includes(
            usersRef.current.find((u) => u.id === id)?.email || "\u0000",
          )
        )
          return;
        const avatar = row.querySelector<HTMLElement>(".avatar");
        if (avatar) {
          avatar.style.backgroundImage = url ? `url(${url})` : "";
          avatar.classList.toggle("hasPhoto", !!url);
        }
      });
  };
  return editor
    ? createPortal(
        <AdminAccountPhotoEditor
          user={editor.user}
          avatar={avatars[editor.user.id]}
          onChanged={(url) => changed(editor.user.id, url)}
        />,
        editor.host,
      )
    : null;
}

function AdminAccountPhotoEditor({
  user,
  avatar,
  onChanged,
}: {
  user: AdminUser;
  avatar: string | null | undefined;
  onChanged: (url: string | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const upload = async (file?: File) => {
    if (!file) return;
    try {
      setBusy(true);
      const dataUrl = await imageData(file),
        x = await api(`/api/admin/accounts/${user.id}/avatar`, {
          method: "POST",
          body: JSON.stringify({ dataUrl }),
        });
      onChanged(x.avatarUrl);
      setNotice("User photo updated");
    } catch (e: any) {
      setNotice(e.message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  const remove = async () => {
    try {
      setBusy(true);
      await api(`/api/admin/accounts/${user.id}/avatar`, { method: "DELETE" });
      onChanged(null);
      setNotice("User photo removed");
    } catch (e: any) {
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  };
  const initials = user.name
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("");
  return (
    <div className="adminAccountPhoto">
      <div className="editorAvatar">
        {avatar ? <img src={avatar} alt="User photo" /> : initials}
      </div>
      <div>
        <b>User photo</b>
        <small>PNG, JPEG or WebP · maximum 2 MB</small>
        <span>
          <input
            ref={input}
            hidden
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => upload(e.target.files?.[0])}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            <Camera />
            {busy ? "Uploading…" : avatar ? "Change photo" : "Upload photo"}
          </button>
          {avatar && (
            <button
              className="removeUserPhoto"
              type="button"
              disabled={busy}
              onClick={remove}
            >
              <Trash2 />
              Remove photo
            </button>
          )}
        </span>
        {notice && <em>{notice}</em>}
      </div>
    </div>
  );
}
