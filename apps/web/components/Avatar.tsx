export function Avatar({ src, name }: { src?: string | null; name: string }) {
  return <div className="avatar">{src ? <img src={src} alt="" /> : name.slice(0, 1).toUpperCase()}</div>
}
