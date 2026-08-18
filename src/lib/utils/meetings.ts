interface RawAttendeeJoin {
  members: { id: string; name: string; initials: string; color: string } | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function flattenAttendees(row: any) {
  const { meeting_attendees, ...rest } = row
  return {
    ...rest,
    attendees: ((meeting_attendees ?? []) as RawAttendeeJoin[])
      .map(a => a.members)
      .filter((m): m is NonNullable<RawAttendeeJoin['members']> => !!m),
  }
}
