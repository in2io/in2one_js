// React から使う例。
//   npm install @in2one/one-js
import { useState } from "react";
import { In2OneEmbed } from "@in2one/one-js/react";
import type { EmbedError, EmbedSubmitPayload } from "@in2one/one-js";

export function BookingSection({ hako }: { hako: string }) {
  const [done, setDone] = useState<string | null>(null);

  if (done) return <p>ご予約を承りました（受付番号: {done}）</p>;

  return (
    <In2OneEmbed
      feature="booking"
      token={process.env.NEXT_PUBLIC_IN2ONE_TOKEN as string}
      // params が変わると iframe を作り直す。中身で比較するので、
      // オブジェクトを毎回作り直しても問題ない。
      params={{ hako }}
      locale="ja"
      theme="auto"
      prefill={{ email: "guest@example.com" }}
      className="rounded-xl shadow"
      onSubmit={(payload: EmbedSubmitPayload) => setDone(payload.uuid ?? "")}
      onError={(error: EmbedError) => console.error(error.code, error.message)}
    />
  );
}
