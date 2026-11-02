import { useState } from 'react';

export default function App() {
  const [quacks, setQuacks] = useState(0);

  return (
    <main>
      <span className="duck" role="img" aria-label="Duck">🦆</span>
      <p className="eyebrow">WELCOME TO YOUR NEXT LITTLE ADVENTURE</p>
      <h1>Ducky Land</h1>
      <p>Your React app is ready. Let’s make something fun.</p>
      <button onClick={() => setQuacks((count) => count + 1)}>
        Quack{quacks > 0 ? ` · ${quacks}` : ''}
      </button>
      <p className="hint" aria-live="polite">
        {quacks > 0 ? 'A little louder, a little happier.' : 'Go on, say hello.'}
      </p>
    </main>
  );
}
