'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getRole, type Role } from '@/lib/roles'

export function useRole(): Role {
  const [role, setRole] = useState<Role>('default')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setRole(getRole(user.user_metadata))
    })
  }, [])

  return role
}
