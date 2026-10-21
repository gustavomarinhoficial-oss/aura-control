interface RawAssigneeJoin {
  members: { id: string; name: string; initials: string; color: string } | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function flattenAssignees(row: any) {
  const { task_assignees, task_items, ...rest } = row
  const items = (task_items ?? []) as { completed: boolean }[]
  return {
    ...rest,
    items_total: items.length,
    items_done: items.filter(i => i.completed).length,
    assignees: ((task_assignees ?? []) as RawAssigneeJoin[])
      .map(ta => ta.members)
      .filter((m): m is NonNullable<RawAssigneeJoin['members']> => !!m),
  }
}
