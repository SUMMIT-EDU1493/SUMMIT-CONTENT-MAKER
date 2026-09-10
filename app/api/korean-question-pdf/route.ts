import { jsPDF } from "jspdf";
import fs from "fs";
import path from "path";

export const maxDuration = 60;

type Passage = {
  id: string;
  title: string;
  content: string;
};

type Question = {
  id: string;
  passageId: string;
  passageTitle: string;
  type: string;
  difficulty: "중" | "상";
  stem: string;
  boxText?: string;
  targetWord?: string;
  choices: string[];
  answer: number;
  explanation: string;
  choiceExplanations: string[];
};

function clean(value: unknown) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\r/g, "")
    .trim();
}

export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json();

    const schoolName =
      clean(body?.schoolName);

    const gradeName =
      clean(body?.gradeName);

    const materialName =
      clean(body?.materialName);

    const passages: Passage[] =
      Array.isArray(body?.passages)
        ? body.passages
        : [];

    const questions: Question[] =
      Array.isArray(body?.questions)
        ? body.questions
        : [];

    if (
      passages.length === 0 ||
      questions.length === 0
    ) {
      return Response.json(
        {
          error:
            "PDF로 저장할 지문과 문제가 없습니다.",
        },
        {
          status: 400,
        }
      );
    }

    const regularPath =
      path.join(
        process.cwd(),
        "public",
        "fonts",
        "NanumGothic-Regular.ttf"
      );

    const boldPath =
      path.join(
        process.cwd(),
        "public",
        "fonts",
        "NotoSansKR-Bold.ttf"
      );

    if (
      !fs.existsSync(
        regularPath
      ) ||
      !fs.existsSync(
        boldPath
      )
    ) {
      throw new Error(
        "PDF용 한글 폰트를 찾지 못했습니다."
      );
    }

    const regularBase64 =
      fs
        .readFileSync(
          regularPath
        )
        .toString(
          "base64"
        );

    const boldBase64 =
      fs
        .readFileSync(
          boldPath
        )
        .toString(
          "base64"
        );

    const doc =
      new jsPDF({
        orientation:
          "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });

    doc.addFileToVFS(
      "NanumGothic-Regular.ttf",
      regularBase64
    );

    doc.addFont(
      "NanumGothic-Regular.ttf",
      "NanumGothic",
      "normal"
    );

    doc.addFileToVFS(
      "NotoSansKR-Bold.ttf",
      boldBase64
    );

    doc.addFont(
      "NotoSansKR-Bold.ttf",
      "NotoSansKR",
      "bold"
    );

    const pageWidth =
      doc.internal.pageSize.getWidth();

    const pageHeight =
      doc.internal.pageSize.getHeight();

    const marginLeft = 15;
    const marginRight = 15;
    const topMargin = 13;
    const bottomMargin = 17;

    const contentWidth =
      pageWidth -
      marginLeft -
      marginRight;

    let y =
      topMargin;

    const regular = (
      size = 9
    ) => {
      doc.setFont(
        "NanumGothic",
        "normal"
      );

      doc.setFontSize(
        size
      );

      doc.setTextColor(
        20,
        20,
        20
      );
    };

    const bold = (
      size = 9
    ) => {
      doc.setFont(
        "NotoSansKR",
        "bold"
      );

      doc.setFontSize(
        size
      );

      doc.setTextColor(
        20,
        20,
        20
      );
    };

    const newPage = () => {
      doc.addPage();

      y =
        topMargin;
    };

    const ensureSpace = (
      height: number
    ) => {
      if (
        y + height >
        pageHeight -
          bottomMargin
      ) {
        newPage();
      }
    };

    const split = (
      text: string,
      width =
        contentWidth
    ): string[] => {
      const value =
        clean(text);

      if (!value) {
        return [];
      }

      const result:
        string[] = [];

      value
        .split("\n")
        .forEach(
          (
            paragraph,
            paragraphIndex,
            array
          ) => {
            if (
              paragraph.trim()
            ) {
              const lines =
                doc.splitTextToSize(
                  paragraph.trim(),
                  width
                ) as string[];

              result.push(
                ...lines
              );
            }

            if (
              paragraphIndex <
              array.length - 1
            ) {
              result.push(
                ""
              );
            }
          }
        );

      return result;
    };

    const write = (
      text: string,
      options?: {
        size?: number;
        lineHeight?: number;
        isBold?: boolean;
        x?: number;
        width?: number;
        gapAfter?: number;
      }
    ) => {
      const size =
        options?.size ??
        9;

      const lineHeight =
        options?.lineHeight ??
        4.4;

      const x =
        options?.x ??
        marginLeft;

      const width =
        options?.width ??
        contentWidth;

      if (
        options?.isBold
      ) {
        bold(
          size
        );
      } else {
        regular(
          size
        );
      }

      const lines =
        split(
          text,
          width
        );

      lines.forEach(
        (
          line
        ) => {
          ensureSpace(
            lineHeight
          );

          if (
            !line
          ) {
            y +=
              lineHeight *
              0.5;

            return;
          }

          doc.text(
            line,
            x,
            y
          );

          y +=
            lineHeight;
        }
      );

      y +=
        options?.gapAfter ??
        0;
    };

    const divider = (
      gapTop = 1,
      gapBottom = 3
    ) => {
      y += gapTop;

      ensureSpace(
        4
      );

      doc.setDrawColor(
        185,
        185,
        185
      );

      doc.setLineWidth(
        0.2
      );

      doc.line(
        marginLeft,
        y,
        pageWidth -
          marginRight,
        y
      );

      y +=
        gapBottom;
    };

    const choiceMarks =
      [
        "1)",
        "2)",
        "3)",
        "4)",
        "5)",
      ];

    // ==========================================
    // 첫 페이지 헤더
    // ==========================================

    bold(
      7.5
    );

    doc.setTextColor(
      91,
      59,
      150
    );

    doc.text(
      "SUMMIT VISUAL LAB",
      marginLeft,
      y
    );

    y += 5;

    bold(
      14
    );

    doc.setTextColor(
      15,
      15,
      15
    );

    doc.text(
      "수능형 국어 독서 문제",
      marginLeft,
      y
    );

    y += 5;

    regular(
      8
    );

    doc.setTextColor(
      95,
      95,
      95
    );

    const info =
      [
        schoolName,
        gradeName,
        materialName,
      ]
        .filter(
          Boolean
        )
        .join(
          " · "
        );

    if (info) {
      doc.text(
        info,
        marginLeft,
        y
      );

      y += 4.5;
    }

    divider(
      0,
      4
    );

    // ==========================================
    // 문제
    // ==========================================

    let globalNumber =
      1;

    for (
      const passage of passages
    ) {
      const passageQuestions =
        questions.filter(
          (
            question
          ) =>
            question.passageId ===
            passage.id
        );

      if (
        passageQuestions.length ===
        0
      ) {
        continue;
      }

      ensureSpace(
        18
      );

      write(
        passage.title,
        {
          size: 10,
          lineHeight: 4.8,
          isBold: true,
          gapAfter: 2,
        }
      );

      write(
        passage.content,
        {
          size: 8.6,
          lineHeight: 4.25,
          gapAfter: 6,
        }
      );

      for (
        const question of passageQuestions
      ) {
        ensureSpace(
          18
        );

        regular(
          7.2
        );

        doc.setTextColor(
          105,
          105,
          105
        );

        doc.text(
          `${question.type} · 난이도 ${question.difficulty}`,
          marginLeft,
          y
        );

        y += 4;

        write(
          `${globalNumber}. ${question.stem}`,
          {
            size: 9.3,
            lineHeight: 4.6,
            isBold: true,
            gapAfter: 1.2,
          }
        );

        if (
          question.targetWord
        ) {
          write(
            `대상 어휘 : ${question.targetWord}`,
            {
              size: 8.3,
              lineHeight: 4,
              gapAfter: 1,
            }
          );
        }

        if (
          question.boxText
        ) {
          const boxLines =
            split(
              question.boxText,
              contentWidth -
                12
            );

          const boxHeight =
            Math.max(
              12,
              boxLines.length *
                4.1 +
                9
            );

          ensureSpace(
            boxHeight +
              2
          );

          doc.setDrawColor(
            120,
            120,
            120
          );

          doc.setLineWidth(
            0.25
          );

          doc.rect(
            marginLeft,
            y,
            contentWidth,
            boxHeight
          );

          bold(
            8
          );

          doc.text(
            "<보기>",
            pageWidth /
              2,
            y + 4.5,
            {
              align:
                "center",
            }
          );

          regular(
            8.3
          );

          let boxY =
            y + 9;

          boxLines.forEach(
            (
              line
            ) => {
              if (
                line
              ) {
                doc.text(
                  line,
                  marginLeft +
                    6,
                  boxY
                );
              }

              boxY +=
                4.1;
            }
          );

          y +=
            boxHeight +
            3;
        }

        question.choices
          .slice(
            0,
            5
          )
          .forEach(
            (
              choice,
              index
            ) => {
              write(
                `${choiceMarks[index] ?? `${index + 1}.`} ${choice}`,
                {
                  size: 8.7,
                  lineHeight: 4.25,
                  gapAfter: 0.4,
                }
              );
            }
          );

        y += 2;

        globalNumber +=
          1;
      }

      divider(
        1,
        4
      );
    }

    // ==========================================
    // 해답·해설
    // ==========================================

    newPage();

    bold(
      14
    );

    doc.text(
      "정답 및 해설",
      marginLeft,
      y
    );

    y += 5;

    regular(
      8
    );

    doc.setTextColor(
      95,
      95,
      95
    );

    if (info) {
      doc.text(
        info,
        marginLeft,
        y
      );

      y += 4;
    }

    divider(
      0,
      4
    );

    questions.forEach(
      (
        question,
        index
      ) => {
        ensureSpace(
          20
        );

        write(
          `${index + 1}. 정답 ${question.answer}번`,
          {
            size: 9.5,
            lineHeight: 4.6,
            isBold: true,
            gapAfter: 1.5,
          }
        );

        write(
          question.explanation,
          {
            size: 8.6,
            lineHeight: 4.3,
            gapAfter: 2,
          }
        );

        if (
          Array.isArray(
            question.choiceExplanations
          ) &&
          question.choiceExplanations.length >
            0
        ) {
          write(
            "선지별 해설",
            {
              size: 8.3,
              lineHeight: 4,
              isBold: true,
              gapAfter: 1,
            }
          );

          question.choiceExplanations
            .slice(
              0,
              5
            )
            .forEach(
              (
                explanation,
                choiceIndex
              ) => {
                write(
                  `${choiceMarks[choiceIndex] ?? `${choiceIndex + 1}.`} ${explanation}`,
                  {
                    size: 8,
                    lineHeight: 4.05,
                    gapAfter: 0.4,
                  }
                );
              }
            );
        }

        divider(
          1,
          3
        );
      }
    );

    // ==========================================
    // 페이지 번호
    // ==========================================

    const totalPages =
      doc.getNumberOfPages();

    for (
      let pageNumber = 1;
      pageNumber <=
      totalPages;
      pageNumber++
    ) {
      doc.setPage(
        pageNumber
      );

      regular(
        7.5
      );

      doc.setTextColor(
        100,
        100,
        100
      );

      doc.text(
        `- ${pageNumber} -`,
        pageWidth /
          2,
        pageHeight -
          8,
        {
          align:
            "center",
        }
      );
    }

    const output =
      doc.output(
        "arraybuffer"
      );

    const fileName =
      [
        schoolName,
        gradeName,
        materialName,
        "수능형국어문제",
      ]
        .filter(
          Boolean
        )
        .join(
          "_"
        )
        .replace(
          /[\\/:*?"<>|]/g,
          "_"
        ) +
      ".pdf";

    return new Response(
      output,
      {
        headers: {
          "Content-Type":
            "application/pdf",

          "Content-Disposition":
            `attachment; filename*=UTF-8''${encodeURIComponent(
              fileName
            )}`,
        },
      }
    );
  } catch (
    error: unknown
  ) {
    console.error(
      "KOREAN QUESTION PDF ERROR:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "PDF 생성 중 오류가 발생했습니다.";

    return Response.json(
      {
        error:
          message,
        detail:
          message,
      },
      {
        status: 500,
      }
    );
  }
}
