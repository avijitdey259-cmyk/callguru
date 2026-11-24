// Shared avatar — every place a person's picture appears uses this, so a
// changed profile photo shows everywhere instead of only in some places.
// photo present -> the photo; no photo -> coloured initial (the only case
// where initials are correct). Pure presentational, no store/Firebase.
export function Avatar({ photo, name, color = '#7C3AED', className = 'w-10 h-10', online = false }: {
  photo?: string | null
  name: string
  color?: string
  className?: string
  online?: boolean
}) {
  const initial = (name || 'U').trim().slice(0, 1) || 'U'
  const dot = online ? <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" /> : null
  if (photo) {
    return (
      <span className={`relative ${className} shrink-0`}>
        <img src={photo} alt="" className="w-full h-full rounded-full object-cover" />
        {dot}
      </span>
    )
  }
  return (
    <span className={`relative ${className} rounded-full text-white flex items-center justify-center font-bold shrink-0`} style={{ background: color }}>
      {initial}
      {dot}
    </span>
  )
}
