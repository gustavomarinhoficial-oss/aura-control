interface RawAssigneeJoin {
  members: { id: string; name: string; initials: string; color: string } | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function flattenAssignees(row: any) {
  const { task_assignees, ...rest } = row
  return {
    ...rest,
    assignees: ((task_assignees ?? []) as RawAssigneeJoin[])
      .map(ta => ta.members)
      .filter((m): m is NonNullable<RawAssigneeJoin['members']> => !!m),
  }
}
