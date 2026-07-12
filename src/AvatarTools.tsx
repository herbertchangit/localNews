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
const imageData = (file: File) =>
  new Promise<string>((resolve, reject) => {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
      return reject(new Error("Choose a PNG, JPEG, or WebP photo"));
    if (file.size > 2 * 1024 * 1024)
      return reject(new Error("Photo must be 2 MB or smaller"));
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read photo"));
    reader.readAsDataURL(file);
  });

function SelfPhotoCard() {
  const [input, setInput] = useState<HTMLInputElement | null>(null),
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
          <p>Upload a photo for your account.</p>
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
          <button
            className="photoPrimary"
            type="button"
            disabled={busy}
            onClick={() => input?.click()}
          >
            <Upload />
            {busy ? "Uploading…" : avatar ? "Change photo" : "Upload photo"}
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
          <small>PNG, JPEG or WebP · maximum 2 MB</small>
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
              const hierarchy =
                row.querySelector<HTMLElement>(".accountHierarchy");
              if (hierarchy) {
                let organization =
                  hierarchy.querySelector<HTMLElement>(".organizationLine");
                if (!organization) {
                  organization = document.createElement("small");
                  organization.className = "organizationLine";
                  const label = document.createElement("i");
                  label.className = "organizationLabel";
                  label.textContent = "Organization";
                  const name = document.createElement("em");
                  name.textContent = user.department?.name || "Unassigned";
                  organization.append(label, document.createTextNode(": "), name);
                  hierarchy.prepend(organization);
                }
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
