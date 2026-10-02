import { AnswerBank } from "@/components/AnswerBank";

export const dynamic = "force-dynamic";

// The answer bank is the profile: the durable facts about you that every
// application form asks for. The old /profile — the Material editor for search
// criteria and the resume corpus — moved to /profile/materials, since it is a
// config surface touched a few times a year rather than a daily one.
export default function ProfilePage() {
  return <AnswerBank />;
}
