import { useEffect, useState } from "react";

export function App() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { email: string } | null) => setEmail(data?.email ?? null));
  }, []);

  return (
    <div>
      <header>{email && <span>{email}</span>}</header>
      <h1>Blockwerk</h1>
    </div>
  );
}
