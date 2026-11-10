import type { DragEvent } from "react";

/*
 * PDF 드래그해서 넣기 (화면 디자인은 바꾸지 않음)
 *
 * 업로드 칸이 들어 있는 상자에 이 핸들러를 붙이면,
 * 상자 위에 PDF를 끌어다 놓았을 때 그 안의 기존 file input에 파일을 넣고
 * change 이벤트를 발생시킵니다.
 * → "PDF 선택" 버튼으로 골랐을 때와 똑같이 기존 onChange 업로드 함수가 실행됩니다.
 */

const isPdfFile = (file: File) =>
  file.type === "application/pdf" ||
  file.name.toLowerCase().endsWith(".pdf");

const findFileInput = (element: HTMLElement) =>
  element.querySelector<HTMLInputElement>('input[type="file"]');

export const pdfDropHandlers = {
  onDragOver(event: DragEvent<HTMLElement>) {
    if (!event.dataTransfer.types.includes("Files")) return;

    event.preventDefault();

    const input = findFileInput(event.currentTarget);

    event.dataTransfer.dropEffect =
      input && !input.disabled ? "copy" : "none";
  },

  onDrop(event: DragEvent<HTMLElement>) {
    if (!event.dataTransfer.types.includes("Files")) return;

    event.preventDefault();

    const input = findFileInput(event.currentTarget);

    if (!input || input.disabled) return;

    const file = Array.from(event.dataTransfer.files).find(isPdfFile);

    if (!file) {
      window.alert("PDF 파일만 올릴 수 있어요.");
      return;
    }

    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  },
};
