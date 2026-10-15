export type PlanningPassage = { text: string; label: string };
export type PlanningSession<T> = {
  key: string;
  passages?: PlanningPassage[];
  completed: Record<number, T>;
};

// Kept in the page's ref, scoped to the exact PDF text and settings.
// Re-running after failure requests only missing passages. Refreshing clears it.
export async function completePlanning<T>(
  session: PlanningSession<T>,
  split: () => Promise<PlanningPassage[]>,
  generate: (passage: PlanningPassage, index: number) => Promise<T>,
  progress: (done: number, total: number) => void,
): Promise<T[]> {
  if (!session.passages) {
    const passages = await split();
    if (!passages.length) throw new Error("분리된 지문이 없습니다.");
    session.passages = passages;
  }
  const passages = session.passages;
  const pending = passages.map((_, index) => index)
    .filter(index => !Object.prototype.hasOwnProperty.call(session.completed, index));
  let next = 0;
  let done = passages.length - pending.length;
  const errors: string[] = [];
  progress(done, passages.length);
  const worker = async () => {
    while (next < pending.length) {
      const index = pending[next++];
      try {
        session.completed[index] = await generate(passages[index], index);
        progress(++done, passages.length);
      } catch (error) {
        errors.push(`${index + 1}번: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, pending.length) }, worker));
  if (errors.length) {
    throw new Error(`${done}/${passages.length}개 설계 완료. 완료한 설계는 이 창에 보관했습니다. 같은 파일과 설정으로 설계안 버튼을 다시 누르면 미완료 지문만 재시도합니다.\n${errors.join("\n")}`);
  }
  return passages.map((_, index) => session.completed[index]);
}

export async function readPlanningResponse(response: Response): Promise<unknown> {
  const raw = await response.text();
  let data: { detail?: string; error?: string };
  try { data = JSON.parse(raw); }
  catch {
    throw new Error(`설계 서버 응답 오류(HTTP ${response.status}). 완료한 지문은 유지됩니다. 잠시 후 같은 버튼으로 재시도해 주세요.`);
  }
  if (!response.ok) throw new Error(data?.detail || data?.error || `설계 요청 실패(HTTP ${response.status})`);
  return data;
}
