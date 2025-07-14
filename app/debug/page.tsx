'use client'

import { useState } from 'react'

export default function DebugPage() {
  const [data, setData] = useState(null)

  const checkDB = async () => {
    const response = await fetch('/api/debug-data')
    const result = await response.json()
    setData(result)
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1>What's in our database?</h1>
      <button onClick={checkDB}>Check Database</button>
      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  )
}
