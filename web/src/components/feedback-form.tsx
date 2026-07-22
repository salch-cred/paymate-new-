"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { Icon } from "@/components/icons"

export function FeedbackForm({ role, invoiceId }: { role: "freelancer" | "client"; invoiceId?: string }) {
  const [name, setName] = useState("")
  const [contact, setContact] = useState("")
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState("")
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, name, contact: contact || null, rating, comment, invoiceId: invoiceId || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Could not submit feedback")
      return data.feedback
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not submit feedback"),
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError("Add your name.")
    if (rating < 1) return setError("Pick a rating.")
    if (comment.trim().length < 3) return setError("Add a short comment.")
    setError(null)
    mutation.mutate()
  }

  if (mutation.isSuccess) {
    return (
      <div className="feedback-card feedback-done">
        <Icon name="check" size={16} />
        <span>Thanks — your feedback helps shape what we build next.</span>
      </div>
    )
  }

  return (
    <form className="feedback-card" onSubmit={submit}>
      <div className="feedback-head">
        <Icon name="spark" size={15} />
        <span>{role === "client" ? "How was paying with PayMate?" : "How's PayMate working for you?"}</span>
      </div>
      <div className="feedback-fields">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Email (optional)" />
      </div>
      <div className="feedback-rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button type="button" key={n} className={n <= rating ? "active" : ""} onClick={() => setRating(n)} aria-label={`Rate ${n} out of 5`}>
            {n}
          </button>
        ))}
      </div>
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What worked, what didn't, what would make this better?" />
      {error && <div className="error-box">{error}</div>}
      <button type="submit" className="button button-dark" disabled={mutation.isPending}>
        {mutation.isPending ? "Sending…" : "Send feedback"}
      </button>
    </form>
  )
}
