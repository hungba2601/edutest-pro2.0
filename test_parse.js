const fs = require('fs');

const rawText = fs.readFileSync('extracted_de_thi_so_4.txt', 'utf8');

// Copy logic từ teacher.js
function extractMcOptions(block) {
  const optRegex = /(?:^|\n|\r|\s{2,}|\t)(?:(?:\(([A-D])\))|([A-D])[\).:])\s+/gi;
  const matches = [];
  let m;
  while ((m = optRegex.exec(block)) !== null) {
    matches.push({
      key: (m[1] || m[2]).toUpperCase(),
      index: m.index,
      matchLen: m[0].length
    });
  }

  if (matches.length >= 2) {
    const firstOpt = matches[0];
    const prompt = block.slice(0, firstOpt.index)
      .replace(/^\s*(?:Câu|Bài|\bQ)\s*\d+[:.-]\s*/i, "")
      .trim();

    const options = [];
    for (let i = 0; i < matches.length; i++) {
      const cur = matches[i];
      const start = cur.index + cur.matchLen;
      const end = (i + 1 < matches.length) ? matches[i + 1].index : block.length;
      let optText = block.slice(start, end).trim();
      optText = optText.replace(/(?:Đáp án|ĐA|Key)[:\s]*[A-D].*$/i, "").trim();

      options.push({
        key: cur.key,
        noiDung: optText
      });
    }

    const requiredKeys = ["A", "B", "C", "D"];
    const finalOptions = requiredKeys.map(k => {
      const found = options.find(o => o.key === k);
      return found || { key: k, noiDung: `Phương án ${k}` };
    });

    return { prompt, options: finalOptions };
  }

  return null;
}

function extractTfOptions(block) {
  // Chú ý: Ở de_thi_so_4.docx là: a. Chỉ có... b. Đồng hồ... (dùng dấu chấm)
  const subRegex = /(?:^|\n|\r|\s{2,}|\t)(?:(?:\(([a-d])\))|([a-d])[\).:])\s+/gi;
  const matches = [];
  let m;
  while ((m = subRegex.exec(block)) !== null) {
    matches.push({
      key: (m[1] || m[2]).toLowerCase(),
      index: m.index,
      matchLen: m[0].length
    });
  }

  if (matches.length >= 2) {
    const firstSub = matches[0];
    const prompt = block.slice(0, firstSub.index)
      .replace(/^\s*(?:Câu|Bài|\bQ)\s*\d+[:.-]\s*/i, "")
      .trim();

    const subItems = [];
    for (let i = 0; i < matches.length; i++) {
      const cur = matches[i];
      const start = cur.index + cur.matchLen;
      const end = (i + 1 < matches.length) ? matches[i + 1].index : block.length;
      let text = block.slice(start, end).trim();

      subItems.push({
        key: cur.key,
        noiDung: text
      });
    }

    return { prompt, subItems };
  }

  return null;
}

function extractAnswerKeysFromDocument(fullText) {
  const mcAnswers = {};
  const tfAnswers = {};

  const answerHeadingRegex = /(?:ĐÁP\s*ÁN\s*VÀ\s*HƯỚNG\s*DẪN\s*CHẤM|HƯỚNG\s*DẪN\s*CHẤM\s*VÀ\s*ĐÁP\s*ÁN|BẢNG\s*ĐÁP\s*ÁN|ĐÁP\s*ÁN\s*CHI\s*TIẾT|ĐÁP\s*ÁN\s*VÀ\s*THANG\s*ĐIỂM|THANG\s*ĐIỂM\s*VÀ\s*ĐÁP\s*ÁN|HƯỚNG\s*DẪN\s*CHẤM)/gi;
  let match;
  let matchPos = -1;
  while ((match = answerHeadingRegex.exec(fullText)) !== null) {
    matchPos = match.index;
  }
  if (matchPos === -1) {
    const standaloneMatch = /(?:^|\n|\r)\s*(?:ĐÁP\s*ÁN|BẢNG\s*ĐÁP\s*ÁN)\s*(?:\n|\r|$)/i.exec(fullText);
    if (standaloneMatch) matchPos = standaloneMatch.index;
  }

  const textToScan = matchPos !== -1 ? fullText.slice(matchPos) : fullText;
  const lines = textToScan.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // Phân tích bảng đúng sai
  for (let i = 0; i < lines.length; i++) {
    const qMatch = lines[i].match(/^Câu\s*(\d+)$/i);
    if (qMatch) {
      const qNum = parseInt(qMatch[1]);
      if (i + 4 < lines.length) {
        const v1 = lines[i + 1].toLowerCase();
        const v2 = lines[i + 2].toLowerCase();
        const v3 = lines[i + 3].toLowerCase();
        const v4 = lines[i + 4].toLowerCase();
        const isTfVal = v => ['đúng', 'sai', 'đ', 's', 'true', 'false'].includes(v);
        if (isTfVal(v1) && isTfVal(v2) && isTfVal(v3) && isTfVal(v4)) {
          tfAnswers[qNum] = {
            a: ['đúng', 'đ', 'true'].includes(v1),
            b: ['đúng', 'đ', 'true'].includes(v2),
            c: ['đúng', 'đ', 'true'].includes(v3),
            d: ['đúng', 'đ', 'true'].includes(v4)
          };
          i += 4;
          continue;
        }
      }
    }
  }

  // Phân tích trắc nghiệm
  for (let i = 0; i < lines.length; i++) {
    if (/^Câu$/i.test(lines[i])) {
      const qNums = [];
      let j = i + 1;
      while (j < lines.length && /^\d+$/.test(lines[j])) {
        qNums.push(parseInt(lines[j]));
        j++;
      }
      if (qNums.length > 0 && j < lines.length && /^Đáp\s*án$/i.test(lines[j])) {
        let k = j + 1;
        let ansIdx = 0;
        while (k < lines.length && ansIdx < qNums.length && /^[A-D]$/i.test(lines[k])) {
          const qNum = qNums[ansIdx];
          mcAnswers[qNum] = lines[k].toUpperCase();
          ansIdx++;
          k++;
        }
        i = k - 1;
      }
    }
  }

  return { mcAnswers, tfAnswers };
}

console.log("Answers:", extractAnswerKeysFromDocument(rawText));
