/**
 * ============================================================================
 * SCRIPT TẠO TÀI LIỆU HƯỚNG DẪN SỬ DỤNG HỆ THỐNG EDUTEST PRO 2.0 (FULL TÍNH NĂNG)
 * Phiên bản cập nhật mới nhất: Tháng 11/2026
 * Tác giả: Thầy Nguyễn Phi Hùng (0938.750.424)
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const docx = require('docx');

const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  HeadingLevel,
  AlignmentType,
  PageNumber,
  PageBreak,
  Header,
  Footer,
  ImageRun
} = docx;

// Bảng màu thiết kế chuyên nghiệp (Design Palette)
const COLOR = {
  PRIMARY: "1E3A8A",      // Xanh Navy đậm (Tiêu đề chính)
  SECONDARY: "2563EB",    // Xanh Royal Blue (Tiêu đề phụ, nhấn mạnh)
  ACCENT_GREEN: "059669", // Xanh ngọc lục bảo (Thành công, Tự luận, Tổng hợp điểm)
  ACCENT_AMBER: "D97706", // Vàng hổ phách (Lưu ý, Cảnh báo)
  ACCENT_RED: "DC2626",   // Đỏ ruby (Cảnh báo nguy hiểm, Gian lận)
  ACCENT_PURPLE: "7C3AED",// Tím hoàng gia (Trợ lý AI Gemini)
  DARK_TEXT: "1E293B",    // Xám đen đậm (Nội dung chính)
  MUTED_TEXT: "64748B",   // Xám trung tính (Ghi chú, phụ đề)
  LIGHT_BG: "F8FAFC",     // Nền xám rất nhạt
  LIGHT_BLUE: "EFF6FF",   // Nền xanh nhạt
  LIGHT_GREEN: "ECFDF5",  // Nền xanh lá nhạt
  LIGHT_AMBER: "FFFBEB",  // Nền vàng nhạt
  LIGHT_RED: "FEF2F2",    // Nền đỏ nhạt
  LIGHT_PURPLE: "F5F3FF", // Nền tím nhạt
  BORDER_LIGHT: "CBD5E1", // Viền xám nhạt
  WHITE: "FFFFFF"
};

// Helper tạo Paragraph có khoảng cách chuẩn
function p(text = "", opts = {}) {
  const runs = [];
  if (typeof text === "string" && text.length > 0) {
    runs.push(new TextRun({
      text,
      font: "Arial",
      size: opts.size || 22, // 11pt mặc định
      color: opts.color || COLOR.DARK_TEXT,
      bold: opts.bold || false,
      italics: opts.italics || false
    }));
  }

  return new Paragraph({
    alignment: opts.alignment || AlignmentType.LEFT,
    spacing: {
      before: opts.spacingBefore !== undefined ? opts.spacingBefore : 80,
      after: opts.spacingAfter !== undefined ? opts.spacingAfter : 80,
      line: opts.line || 276 // 1.15 line spacing
    },
    children: opts.children || runs,
    bullet: opts.bullet || undefined
  });
}

// Helper tạo Paragraph danh sách đầu dòng (Bullet item)
function bulletItem(boldPrefix, content, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 40, after: 40, line: 260 },
    bullet: { level: opts.level || 0 },
    children: [
      new TextRun({
        text: boldPrefix ? boldPrefix + " " : "",
        font: "Arial",
        size: opts.size || 22,
        bold: true,
        color: opts.prefixColor || COLOR.DARK_TEXT
      }),
      new TextRun({
        text: content,
        font: "Arial",
        size: opts.size || 22,
        color: opts.textColor || COLOR.DARK_TEXT,
        italics: opts.italics || false
      })
    ]
  });
}

// Helper tạo Tiêu đề Heading 1, 2, 3
function h1(title) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 340, after: 120 },
    children: [
      new TextRun({
        text: title,
        font: "Arial",
        size: 30, // 15pt
        bold: true,
        color: COLOR.PRIMARY
      })
    ]
  });
}

function h2(title) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 100 },
    children: [
      new TextRun({
        text: title,
        font: "Arial",
        size: 25, // 12.5pt
        bold: true,
        color: COLOR.SECONDARY
      })
    ]
  });
}

function h3(title) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 180, after: 80 },
    children: [
      new TextRun({
        text: title,
        font: "Arial",
        size: 23, // 11.5pt
        bold: true,
        color: "0F766E"
      })
    ]
  });
}

// Helper tạo Hộp thông báo nổi bật (Callout Box)
function calloutBox(title, lines, type = "info") {
  let borderColor = COLOR.SECONDARY;
  let bgFill = COLOR.LIGHT_BLUE;
  let titleColor = COLOR.PRIMARY;
  let icon = "💡";

  if (type === "warning") {
    borderColor = COLOR.ACCENT_AMBER;
    bgFill = COLOR.LIGHT_AMBER;
    titleColor = "B45309";
    icon = "⚠️";
  } else if (type === "danger") {
    borderColor = COLOR.ACCENT_RED;
    bgFill = COLOR.LIGHT_RED;
    titleColor = "B91C1C";
    icon = "🚨";
  } else if (type === "success") {
    borderColor = COLOR.ACCENT_GREEN;
    bgFill = COLOR.LIGHT_GREEN;
    titleColor = "047857";
    icon = "✅";
  } else if (type === "ai") {
    borderColor = COLOR.ACCENT_PURPLE;
    bgFill = COLOR.LIGHT_PURPLE;
    titleColor = "6D28D9";
    icon = "✨";
  }

  const pList = [];
  if (title) {
    pList.push(new Paragraph({
      spacing: { before: 0, after: 60 },
      children: [
        new TextRun({ text: `${icon} ${title}`, font: "Arial", size: 22, bold: true, color: titleColor })
      ]
    }));
  }

  for (const line of lines) {
    pList.push(new Paragraph({
      spacing: { before: 40, after: 40, line: 260 },
      children: [
        new TextRun({ text: line, font: "Arial", size: 21, color: COLOR.DARK_TEXT })
      ]
    }));
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              left: { style: BorderStyle.SINGLE, size: 28, color: borderColor },
              top: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE }
            },
            shading: { fill: bgFill },
            margins: { top: 120, bottom: 120, left: 180, right: 180 },
            children: pList
          })
        ]
      })
    ]
  });
}

// Helper tạo Bảng chuẩn định dạng đẹp mắt
function createTable(headers, rowsData, colWidths = []) {
  const tableRows = [];

  // Header row
  const headerCells = headers.map((h, i) => {
    return new TableCell({
      width: colWidths[i] ? { size: colWidths[i], type: WidthType.PERCENTAGE } : undefined,
      shading: { fill: COLOR.PRIMARY },
      margins: { top: 100, bottom: 100, left: 120, right: 120 },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 6, color: COLOR.PRIMARY },
        bottom: { style: BorderStyle.SINGLE, size: 12, color: COLOR.PRIMARY },
        left: { style: BorderStyle.SINGLE, size: 6, color: "3B82F6" },
        right: { style: BorderStyle.SINGLE, size: 6, color: "3B82F6" }
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 40, after: 40 },
          children: [
            new TextRun({ text: h, font: "Arial", size: 20, bold: true, color: COLOR.WHITE })
          ]
        })
      ]
    });
  });
  tableRows.push(new TableRow({ tableHeader: true, children: headerCells }));

  // Data rows
  rowsData.forEach((row, rowIndex) => {
    const isEven = rowIndex % 2 === 0;
    const bg = isEven ? COLOR.WHITE : COLOR.LIGHT_BG;

    const dataCells = row.map((cellText, colIndex) => {
      let isFirstCol = colIndex === 0;
      let align = isFirstCol && String(cellText).length < 5 ? AlignmentType.CENTER : AlignmentType.LEFT;

      return new TableCell({
        width: colWidths[colIndex] ? { size: colWidths[colIndex], type: WidthType.PERCENTAGE } : undefined,
        shading: { fill: bg },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: COLOR.BORDER_LIGHT },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR.BORDER_LIGHT },
          left: { style: BorderStyle.SINGLE, size: 4, color: COLOR.BORDER_LIGHT },
          right: { style: BorderStyle.SINGLE, size: 4, color: COLOR.BORDER_LIGHT }
        },
        children: [
          new Paragraph({
            alignment: align,
            spacing: { before: 30, after: 30, line: 240 },
            children: [
              new TextRun({
                text: String(cellText),
                font: "Arial",
                size: 20,
                color: COLOR.DARK_TEXT,
                bold: isFirstCol && String(cellText).length > 4 && colIndex === 0
              })
            ]
          })
        ]
      });
    });

    tableRows.push(new TableRow({ children: dataCells }));
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows
  });
}

// XÂY DỰNG TOÀN BỘ NỘI DUNG TÀI LIỆU
async function generateDocx() {
  console.log("Bat dau khoi tao tai lieu Huong Dan Su Dung EduTest Pro 2.0...");

  // Kiểm tra ảnh minh họa
  let imageRunInstance = null;
  const imagePath = path.join(__dirname, "a1.png");
  if (fs.existsSync(imagePath)) {
    const imgBuffer = fs.readFileSync(imagePath);
    imageRunInstance = new ImageRun({
      data: imgBuffer,
      transformation: {
        width: 540,
        height: 303
      }
    });
  }

  const sectionsChildren = [];

  // =========================================================================
  // TRANG BÌA (COVER PAGE)
  // =========================================================================
  sectionsChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 180, after: 60 },
      children: [
        new TextRun({
          text: "BỘ GIÁO DỤC VÀ ĐÀO TẠO - TÀI LIỆU CÔNG NGHỆ CHUYỂN ĐỔI SỐ",
          font: "Arial",
          size: 19,
          bold: true,
          color: COLOR.MUTED_TEXT
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 60, after: 180 },
      children: [
        new TextRun({
          text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
          font: "Arial",
          size: 18,
          color: COLOR.BORDER_LIGHT
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 140, after: 100 },
      children: [
        new TextRun({
          text: "HỆ THỐNG THI TRẮC NGHIỆM TRỰC TUYẾN",
          font: "Arial",
          size: 32,
          bold: true,
          color: COLOR.PRIMARY
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 120 },
      children: [
        new TextRun({
          text: "EDUTEST PRO 2.0",
          font: "Arial",
          size: 46,
          bold: true,
          color: COLOR.SECONDARY
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 200 },
      children: [
        new TextRun({
          text: "TÍCH HỢP TRỢ LÝ AI GEMINI • KIẾN TRÚC CENTRAL HUB • TỔNG HỢP ĐIỂM TRẮC NGHIỆM & TỰ LUẬN",
          font: "Arial",
          size: 20,
          bold: true,
          color: "0F766E"
        })
      ]
    })
  );

  // Chèn ảnh minh họa nếu có
  if (imageRunInstance) {
    sectionsChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80, after: 200 },
        children: [imageRunInstance]
      })
    );
  }

  // Bảng thông tin tác giả & phiên bản trên trang bìa
  const coverTable = new Table({
    width: { size: 92, type: WidthType.PERCENTAGE },
    alignment: AlignmentType.CENTER,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 32, type: WidthType.PERCENTAGE },
            shading: { fill: COLOR.LIGHT_BG },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              left: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              right: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT }
            },
            children: [p("Tác giả phát triển:", { bold: true, color: COLOR.PRIMARY })]
          }),
          new TableCell({
            width: { size: 68, type: WidthType.PERCENTAGE },
            shading: { fill: COLOR.WHITE },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              left: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              right: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT }
            },
            children: [p("Thầy NGUYỄN PHI HÙNG", { bold: true, color: COLOR.DARK_TEXT })]
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: 32, type: WidthType.PERCENTAGE },
            shading: { fill: COLOR.LIGHT_BG },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              left: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              right: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT }
            },
            children: [p("Kênh tư vấn & Hỗ trợ Zalo:", { bold: true, color: COLOR.PRIMARY })]
          }),
          new TableCell({
            width: { size: 68, type: WidthType.PERCENTAGE },
            shading: { fill: COLOR.WHITE },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              left: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              right: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT }
            },
            children: [p("0938.750.424 (Hỗ trợ giáo viên & nhà trường 24/7)", { bold: true, color: COLOR.SECONDARY })]
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: 32, type: WidthType.PERCENTAGE },
            shading: { fill: COLOR.LIGHT_BG },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              left: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              right: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT }
            },
            children: [p("Nền tảng công nghệ:", { bold: true, color: COLOR.PRIMARY })]
          }),
          new TableCell({
            width: { size: 68, type: WidthType.PERCENTAGE },
            shading: { fill: COLOR.WHITE },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              left: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              right: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT }
            },
            children: [p("Serverless Cloud (Google Apps Script + Google Sheets + Gemini AI)", { color: COLOR.DARK_TEXT })]
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: 32, type: WidthType.PERCENTAGE },
            shading: { fill: COLOR.LIGHT_BG },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              left: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              right: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT }
            },
            children: [p("Phiên bản cập nhật:", { bold: true, color: COLOR.PRIMARY })]
          }),
          new TableCell({
            width: { size: 68, type: WidthType.PERCENTAGE },
            shading: { fill: COLOR.WHITE },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              left: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              right: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT }
            },
            children: [p("EduTest Pro 2.0 - Bản phát hành chính thức Full tính năng (11/2026)", { bold: true, color: "047857" })]
          })
        ]
      })
    ]
  });

  sectionsChildren.push(
    coverTable,
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 0 },
      children: [
        new TextRun({
          text: "LƯU HÀNH NỘI BỘ - DÀNH CHO CÁN BỘ QUẢN LÝ, BAN GIÁM HIỆU, GIÁO VIÊN VÀ HỌC SINH",
          font: "Arial",
          size: 18,
          italics: true,
          color: COLOR.MUTED_TEXT
        })
      ]
    }),
    new Paragraph({ children: [new PageBreak()] })
  );

  // =========================================================================
  // MỤC LỤC TỔNG QUAN
  // =========================================================================
  sectionsChildren.push(
    h1("MỤC LỤC TỔNG QUAN HỆ THỐNG"),
    p("Tài liệu hướng dẫn sử dụng toàn diện này gồm 9 chuyên đề lớn cập nhật toàn bộ tính năng mới nhất:"),
    bulletItem("PHẦN I:", "TỔNG QUAN HỆ THỐNG THI TRẮC NGHIỆM TRỰC TUYẾN EDUTEST PRO 2.0"),
    bulletItem("PHẦN II:", "HƯỚNG DẪN THIẾT LẬP MÁY CHỦ GOOGLE APPS SCRIPT & CSDL GOOGLE SHEETS"),
    bulletItem("PHẦN III:", "HƯỚNG DẪN CHI TIẾT DÀNH CHO GIÁO VIÊN & ADMIN (CỔNG QUẢN TRỊ)"),
    bulletItem("PHẦN IV:", "HƯỚNG DẪN PHÂN HỆ MỚI: TAB 'TỔNG HỢP ĐIỂM' (TRẮC NGHIỆM & TỰ LUẬN)"),
    bulletItem("PHẦN V:", "HƯỚNG DẪN CHI TIẾT DÀNH CHO HỌC SINH (PHÒNG THI TRỰC TUYẾN & CHỐNG GIAN LẬN)"),
    bulletItem("PHẦN VI:", "MÔ HÌNH TRẠM TRUNG TÂM (CENTRAL HUB) & MÁY CHỦ PHÂN TÁN TOÀN TRƯỜNG"),
    bulletItem("PHẦN VII:", "CÁC TIỆN ÍCH ĐẶC BIỆT: NHẠC NỀN DU DƯƠNG & TRẢI NGHIỆM ĐA NỀN TẢNG"),
    bulletItem("PHẦN VIII:", "BẢNG TỔNG HỢP CÂU HỎI THƯỜNG GẶP (FAQ) & HƯỚNG DẪN XỬ LÝ SỰ CỐ"),
    bulletItem("PHẦN IX:", "THÔNG TIN LIÊN HỆ, BẢN QUYỀN & HỖ TRỢ KỸ THUẬT"),
    new Paragraph({ spacing: { before: 120, after: 120 } }),
    calloutBox("ĐIỂM MỚI NỔI BẬT TRONG BẢN CẬP NHẬT 2026", [
      "1. Bổ sung phân hệ Tab 'Tổng Hợp Điểm': Ghép điểm trắc nghiệm tự động với điểm tự luận nhập từ Excel.",
      "2. Bổ sung phân quyền Ban Giám Hiệu (BGH): Chỉ xem thống kê toàn trường, không chỉnh sửa/xóa bài thi.",
      "3. Cơ chế Chống nhìn trộm Tự luận (Anti-Peep Mode): Tự động gạch ngang chữ gõ và thu nhỏ, có nút con mắt 👁️.",
      "4. Giám sát toàn màn hình (Anti-Cheat 2.0): Bịt kín lỗ hổng khi học sinh bấm 'Nộp bài' rồi 'Cancel' vẫn giữ toàn màn hình.",
      "5. Xóa kết quả thi trực tiếp trên giao diện (Direct DOM Sync): Cố định ngay trạng thái Chưa làm bài, không bị nhảy lại điểm.",
      "6. Tính năng Chia sẻ & Sao chép đề thi 1 click giữa các giáo viên trong danh bạ trường.",
      "7. Nhạc nền 3 bài hát bất hủ: 'Woman in Love' (50%), 'Love Story' (30%), 'Sealed With a Kiss' (30%) tự động chuyển âm lượng."
    ], "success"),
    new Paragraph({ children: [new PageBreak()] })
  );

  // =========================================================================
  // PHẦN I: TỔNG QUAN HỆ THỐNG
  // =========================================================================
  sectionsChildren.push(
    h1("PHẦN I: TỔNG QUAN HỆ THỐNG THI TRẮC NGHIỆM TRỰC TUYẾN EDUTEST PRO 2.0"),
    h2("1.1 Mục tiêu phát triển & Ý nghĩa thực tiễn"),
    p("Trong quá trình đổi mới căn bản và toàn diện giáo dục, việc ứng dụng công nghệ thông tin vào kiểm tra, đánh giá học sinh theo Chương trình Giáo dục Phổ thông 2018 đòi hỏi các công cụ khảo thí phải linh hoạt, chính xác và bám sát quy chuẩn đề thi mới của Bộ GD&ĐT."),
    p("EduTest Pro 2.0 được phát triển nhằm mục tiêu giải quyết triệt để những bất cập của các công cụ khảo thí thông thường:"),
    bulletItem("• Đối với Google Forms:", "Giao diện đơn điệu, dễ bị thí sinh gian lận mở tab tra cứu, không hỗ trợ dạng bài Đúng/Sai 4 ý chấm điểm theo thang lũy tiến mới của Bộ, và không có cơ chế quản lý sổ điểm lớp học."),
    bulletItem("• Đối với các phần mềm trực tuyến thương mại:", "Mất phí duy trì máy chủ hàng tháng/năm, giáo viên không nắm giữ trực tiếp cơ sở dữ liệu, nguy cơ rò rỉ đề thi và khó khăn trong việc tùy biến nội dung giảng dạy."),
    p("EduTest Pro 2.0 là giải pháp máy chủ serverless hoàn toàn miễn phí trọn đời, trao trọn 100% quyền sở hữu cơ sở dữ liệu cho giáo viên và nhà trường trên chính tài khoản Google cá nhân."),

    h2("1.2 Kiến trúc công nghệ không máy chủ (Serverless Cloud Architecture)"),
    p("Hệ thống vận hành mượt mà nhờ sự kết hợp hài hòa giữa 4 tầng công nghệ:"),
    bulletItem("1. Frontend Tối Ưu Tốc Độ (Client-side):", "Xây dựng bằng HTML5, CSS3 phong cách Glassmorphism và Vanilla JavaScript ES6+. Thời gian tải trang dưới 1 giây, hoạt động trơn tru trên mọi thiết bị máy tính, máy tính bảng và điện thoại."),
    bulletItem("2. Backend Serverless (Google Apps Script - GAS):", "Sử dụng hạ tầng đám mây Google để tiếp nhận và phản hồi API xác thực, lưu điểm, bóc tách đề, đồng bộ danh bạ."),
    bulletItem("3. Cơ Sở Dữ Liệu (Google Sheets):", "Toàn bộ đề thi, danh sách học sinh và điểm số được lưu an toàn trong Google Drive của Thầy/Cô. Giáo viên hoàn toàn làm chủ dữ liệu của mình."),
    bulletItem("4. Trí Tuệ Nhân Tạo (Google Gemini AI):", "Tích hợp các mô hình AI tiên tiến nhất hiện nay (Gemini 3 Flash, Gemini 3.1 Flash-Lite, Gemini 2.5 Flash, Gemini 3.7 Flash) để đọc hiểu và bóc tách đề thi từ Word/PDF siêu tốc."),

    h2("1.3 Phân quyền 4 nhóm người dùng trong hệ thống"),
    bulletItem("• 1. Quản Trị Viên (Admin):", "Toàn quyền quản trị hệ thống, điều phối danh bạ Trạm Trung Tâm (HUB_SERVERS), thêm/sửa/cấp lại mật khẩu cho giáo viên, quản lý cấu hình chung."),
    bulletItem("• 2. Giáo Viên (Teacher):", "Soạn đề thi trắc nghiệm & tự luận, phân quyền lớp thi, quản lý danh sách học sinh các lớp mình dạy, đổi mật khẩu hàng loạt cho học sinh, xem kết quả, xuất bảng điểm trắc nghiệm, tự luận và tổng hợp điểm."),
    bulletItem("• 3. Ban Giám Hiệu (BGH):", "Tài khoản đặc quyền dành riêng cho lãnh đạo nhà trường để theo dõi tiến độ thi, giám sát chất lượng và xem thống kê toàn trường (Chế độ CHỈ XEM, không được chỉnh sửa hay xóa đề thi, bài thi)."),
    bulletItem("• 4. Học Sinh (Student):", "Đăng nhập phòng thi, làm bài trắc nghiệm và tự luận với chế độ chống nhìn trộm, chống gian lận toàn màn hình, xem điểm và xem lại bài thi theo cấu hình của giáo viên."),

    h2("1.4 Bảng so sánh tính năng vượt trội"),
    createTable(
      ["Tiêu chí so sánh", "Google Forms thông thường", "Phần mềm thi trực tuyến trả phí", "EduTest Pro 2.0 (Bản 2026)"],
      [
        ["Chi phí bản quyền & máy chủ", "Miễn phí", "Thu phí theo tháng/năm", "Hoàn toàn miễn phí trọn đời"],
        ["Quyền sở hữu CSDL", "Trên Google cá nhân", "Lưu trên máy chủ nhà cung cấp", "100% trên Google Sheets cá nhân GV"],
        ["Hỗ trợ AI bóc tách đề", "Không có", "Có (giới hạn số lượt/tháng)", "Tích hợp Gemini AI không giới hạn"],
        ["Trắc nghiệm Đúng/Sai 4 ý", "Không hỗ trợ tính lũy tiến", "Hỗ trợ hạn chế", "Chuẩn 100% Bộ GD&ĐT (10%-25%-50%-100%)"],
        ["Phân hệ Tổng Hợp Điểm (TN + TL)", "Không có", "Phải xuất ra Excel ghép thủ công", "Có sẵn: Nhập Excel tự luận tự ghép tổng điểm"],
        ["Chống nhìn trộm Tự luận", "Không có", "Không có", "Độc quyền: Gạch ngang chữ, thu nhỏ & nút 👁️"],
        ["Giám sát toàn màn hình", "Không có", "Có", "Toàn màn hình, phát hiện tab, tự nộp khi quá mức"],
        ["Quyền Ban Giám Hiệu (BGH)", "Không có", "Có ở gói doanh nghiệp", "Có sẵn tài khoản BGH xem toàn trường"],
        ["Xuất đề thi ra Word (.docx)", "Không có", "Có", "Xuất 1 chạm chuẩn ma trận đề thi BGD"],
        ["Nhạc nền thư giãn phòng thi", "Không có", "Không có", "3 ca khúc bất hủ, tự chỉnh âm lượng theo bài"],
        ["Mô hình Trạm Trung Tâm (Hub)", "Không có", "Có nhưng cấu hình phức tạp", "Tự động định tuyến học sinh về đúng GV"]
      ],
      [22, 26, 26, 26]
    ),
    new Paragraph({ spacing: { before: 120, after: 120 } }),
    new Paragraph({ children: [new PageBreak()] })
  );

  // =========================================================================
  // PHẦN II: THIẾT LẬP MÁY CHỦ GOOGLE APPS SCRIPT
  // =========================================================================
  sectionsChildren.push(
    h1("PHẦN II: THIẾT LẬP MÁY CHỦ GOOGLE APPS SCRIPT & CƠ SỞ DỮ LIỆU"),
    p("Hệ thống EduTest Pro 2.0 sử dụng Google Sheets làm cơ sở dữ liệu và Google Apps Script đóng vai trò máy chủ xử lý dữ liệu (Backend). Thầy/Cô chỉ cần cài đặt 1 lần duy nhất trong khoảng 3 đến 5 phút."),

    h2("2.1 Quy trình cài đặt chi tiết từng bước"),
    bulletItem("Bước 1:", "Truy cập Google Drive cá nhân (drive.google.com). Bấm nút '+ Mới' > chọn 'Google Trang tính' để tạo một bảng tính trắng."),
    bulletItem("Bước 2:", "Đặt tên bảng tính theo môn học hoặc lớp của Thầy/Cô (Ví dụ: 'CSDL_EduTest_ThayHung')."),
    bulletItem("Bước 3:", "Trên menu bảng tính, chọn 'Tiện ích mở rộng' (Extensions) > chọn 'Apps Script'."),
    bulletItem("Bước 4:", "Xóa sạch đoạn mã myFunction mặc định trong file Code.gs. Sao chép toàn bộ mã nguồn Teacher_Code.gs (dành cho Giáo viên) hoặc Code.gs (dành cho Trạm Trung Tâm) và dán vào trình soạn thảo."),
    bulletItem("Bước 5:", "Bấm biểu tượng Đĩa mềm (Ctrl + S) để lưu dự án."),

    h2("2.2 Khởi tạo tự động các Sheet dữ liệu chuẩn hóa"),
    p("Tại thanh công cụ phía trên màn hình Apps Script:"),
    bulletItem("1.", "Tại ô chọn hàm thực thi, chọn hàm 'initDatabase'."),
    bulletItem("2.", "Bấm nút 'Chạy' (Run). Lần đầu tiên chạy, Google sẽ yêu cầu cấp quyền: Bấm 'Xem lại quyền' > Chọn tài khoản Google > Bấm 'Nâng cao' > Bấm 'Đi tới [Tên dự án] (không an toàn)' > Bấm 'Cho phép'."),
    bulletItem("3.", "Hệ thống sẽ tự động khởi tạo các bảng dữ liệu đúng cấu trúc cột chuẩn 100%."),

    calloutBox("CẤU TRÚC BẢNG DỮ LIỆU CHUẨN TRONG GOOGLE SHEETS", [
      "1. DATA_HOCSINH: Quản lý danh sách học sinh (Mã HS, Mật khẩu, Lớp, Họ tên, Ngày sinh, Giới tính, Trường).",
      "2. DATA_GIAOVIEN: Danh bạ tài khoản giáo viên bộ môn và giáo viên chủ nhiệm.",
      "3. DATA_DETHI: Lưu trữ thông tin đề thi, thời gian, trạng thái Mở/Đóng, cấu hình xem điểm, chuỗi câu hỏi.",
      "4. DATA_KETQUA: Lưu bảng điểm trắc nghiệm, thời gian nộp bài, số câu đúng và toàn bộ nhật ký bài làm.",
      "5. DATA_TULUAN: Lưu bài làm tự luận chi tiết theo từng cột câu hỏi để giáo viên chấm điểm.",
      "6. HUB_SERVERS & HUB_STUDENTS: (Dành riêng cho Trạm Trung Tâm) Lưu danh bạ máy chủ và định tuyến học sinh toàn trường."
    ], "success"),

    h2("2.3 Triển khai thành Web App (Deploy as Web App)"),
    bulletItem("1.", "Bấm nút màu xanh 'Triển khai' (Deploy) ở góc trên bên phải > Chọn 'Tùy chọn triển khai mới' (New deployment)."),
    bulletItem("2.", "Bấm biểu tượng Bánh răng (Cài đặt) > Chọn 'Ứng dụng web' (Web app)."),
    bulletItem("3. Cấu hình 2 thông số BẮT BUỘC:", ""),
    bulletItem("   • Thực thi dưới dạng (Execute as):", "Chọn 'Tôi' (Me - tài khoản Google của Thầy/Cô)."),
    bulletItem("   • Ai có quyền truy cập (Who has access):", "BẮT BUỘC chọn 'Bất kỳ ai' (Anyone). Đây là điều kiện tiên quyết để học sinh và ứng dụng web có thể kết nối gửi bài."),
    bulletItem("4.", "Bấm nút 'Triển khai' (Deploy) và sao chép đường link 'URL ứng dụng web' có đuôi /exec."),

    h2("2.4 Tiện ích Sao Chép Mã Nguồn GAS Code 1 Chạm ngay trên Web"),
    p("Để giáo viên không phải tìm kiếm hay mở file mã nguồn phức tạp, EduTest Pro 2.0 đã tích hợp trực tiếp toàn bộ mã nguồn mới nhất vào nút 'Sao Chép Mã Nguồn GAS' ngay trên giao diện Cổng Giáo Viên:"),
    bulletItem("•", "Chỉ cần 1 cú click chuột, toàn bộ code chuẩn 5 Sheet của Giáo viên sẽ được sao chép vào bộ nhớ đệm (Clipboard) để dán thẳng vào Google Apps Script!"),

    new Paragraph({ children: [new PageBreak()] })
  );

  // =========================================================================
  // PHẦN III: HƯỚNG DẪN CHI TIẾT DÀNH CHO GIÁO VIÊN & ADMIN
  // =========================================================================
  sectionsChildren.push(
    h1("PHẦN III: HƯỚNG DẪN CHI TIẾT DÀNH CHO GIÁO VIÊN (CỔNG QUẢN TRỊ)"),
    p("Cổng Quản Trị Giáo Viên (teacher_dashboard.html) là không gian làm việc chuyên nghiệp, hiện đại, gồm các phân hệ chính:"),

    h2("3.1 Đăng nhập & Phân quyền Ban Giám Hiệu (BGH)"),
    bulletItem("• Đăng nhập:", "Truy cập index.html, chọn tab 'Giáo viên'. Nhập tài khoản và mật khẩu."),
    bulletItem("• Tài khoản Giáo viên bình thường:", "Toàn quyền soạn đề, chỉnh sửa đề thi, xuất đề Word, xem thống kê, nhập điểm tự luận và xóa bài thi khi cần thiết."),
    bulletItem("• Tài khoản Ban Giám Hiệu (BGH):", "Lãnh đạo nhà trường có thể truy cập để xem toàn bộ kết quả thi của tất cả các lớp, theo dõi phổ điểm và chỉ số KPI toàn trường. Hệ thống tự động khóa tính năng sửa/xóa đối với tài khoản BGH để đảm bảo tính khách quan và an toàn dữ liệu."),

    h2("3.2 Cấu hình Trợ lý AI Google Gemini"),
    bulletItem("1.", "Bấm nút 'Cấu hình Trợ Lý AI' trên thanh điều khiển."),
    bulletItem("2. Lấy API Key miễn phí:", "Truy cập https://aistudio.google.com, đăng nhập tài khoản Google và tạo API key miễn phí. Dán khóa vào ô 'Gemini API Key'."),
    bulletItem("3. Lựa chọn Mô hình AI theo nhu cầu:", ""),
    bulletItem("   - Gemini 3 Flash Preview:", "Mô hình thế hệ mới nhất, tốc độ vượt trội, xử lý đề thi chuẩn xác tuyệt đối (Khuyên dùng)."),
    bulletItem("   - Gemini 3.1 Flash-Lite:", "Phiên bản siêu nhẹ, tiết kiệm tài nguyên tối đa."),
    bulletItem("   - Gemini 2.5 Flash:", "Mô hình kinh điển, cực kỳ ổn định."),
    bulletItem("   - Gemini 3.7 Flash:", "Mô hình cao cấp, tư duy logic chuyên sâu đối với các môn tự nhiên (Toán, Lý, Hóa)."),
    bulletItem("4.", "Khóa API được mã hóa và lưu trữ cục bộ trên máy tính cá nhân của Thầy/Cô, hoàn toàn bảo mật."),

    h2("3.3 Quy trình Soạn đề & Bóc tách Đề thi Thông minh"),
    p("EduTest Pro 2.0 hỗ trợ 3 phương thức tạo đề thi cực kỳ tiện lợi:"),

    h3("Phương thức 1: Bóc tách tự động từ File Word (.docx) hoặc PDF"),
    bulletItem("•", "Kéo thả file đề thi Word hoặc PDF vào vùng tải file."),
    bulletItem("• Bóc tách bằng Thuật Toán (Chuẩn 100%):", "Bóc tách siêu tốc trong 0.2 giây bằng bộ nhận diện nội bộ thông minh, tự động nhận diện câu hỏi, phương án và đáp án gạch chân/in đậm."),
    bulletItem("• Bóc tách bằng Gemini AI:", "Đọc hiểu cấu trúc văn bản tự nhiên, tự động chia đề thi thành 3 phần chuẩn Bộ GD&ĐT."),

    h3("Phương thức 2: Dán trực tiếp văn bản đề thi thô"),
    p("Thầy/Cô có thể bấm vào khung dán văn bản, dán nội dung từ bất kỳ tài liệu nào và bấm nút Bóc tách."),

    h3("Phương thức 3: Soạn thủ công & Hỗ trợ 3 Dạng câu hỏi Chuẩn Bộ GD&ĐT"),
    bulletItem("• Phần I - Trắc nghiệm Nhiều lựa chọn:", "Câu hỏi 4 phương án A, B, C, D (chọn 1 phương án đúng)."),
    bulletItem("• Phần II - Trắc nghiệm Đúng / Sai:", "Mỗi câu hỏi có 4 ý khẳng định a, b, c, d. Điểm được tính theo thang điểm lũy tiến quy định mới của Bộ GD&ĐT (Đúng 1 ý = 10%, Đúng 2 ý = 25%, Đúng 3 ý = 50%, Đúng 4 ý = 100% điểm của câu)."),
    bulletItem("• Phần III - Câu hỏi Tự Luận:", "Học sinh trả lời bằng văn bản trực tiếp trong phòng thi."),

    h3("Công cụ Tiện ích Soạn đề"),
    bulletItem("• Nút '⚡ Chia đều 10đ':", "Tự động phân bổ lại điểm số toàn bộ câu hỏi trong đề để đạt tròn 10.0 điểm."),
    bulletItem("• Nút 'Xuất DOCX':", "Xuất toàn bộ đề thi kèm bảng đáp án chi tiết ra file Word (.docx) chuẩn mẫu Bộ GD&ĐT chỉ với 1 click."),

    h2("3.4 Cấu hình Kỳ kiểm tra & Thiết lập Phòng thi"),
    bulletItem("• Trạng thái Mở / Đóng:", "Mở để học sinh thấy bài thi và vào thi; Đóng để tạm ẩn đề thi trước giờ quy định."),
    bulletItem("• Chế độ Xem lại bài:", ""),
    bulletItem("   - Ôn tập / Luyện tập:", "Cho phép làm nhiều lần, sau khi nộp bài học sinh được xem lại toàn bộ đề thi và đáp án chi tiết."),
    bulletItem("   - Thi / Kiểm tra chính thức:", "Chỉ được làm 1 lần duy nhất, sau khi nộp sẽ khóa bài thi và khóa xem đáp án để bảo mật."),
    bulletItem("• Giám sát toàn màn hình (Fullscreen Proctoring):", "Bắt buộc phóng to màn hình, phát hiện chuyển tab hoặc thu nhỏ cửa sổ. Tự động thu và nộp bài cưỡng chế khi học sinh vi phạm vượt mức cho phép."),
    bulletItem("• Phân quyền Lớp thi:", "Tích chọn Khối và các lớp cụ thể được phép làm đề thi này."),

    h2("3.5 Quản lý Đề thi: Chia sẻ & Sao chép Đề thi 1 Click (Duplicate)"),
    bulletItem("• Chia sẻ đề thi:", "Giáo viên có thể chia sẻ đề thi cho các đồng nghiệp khác trong cùng trường."),
    bulletItem("• Sao chép đề thi (Duplicate Exam):", "Bấm biểu tượng 'Sao chép' trên danh sách đề thi để nhân bản ngay một đề thi mới, giúp giáo viên dễ dàng tạo đề thi cho lớp khác mà không cần soạn lại từ đầu."),

    h2("3.6 Quản lý Học sinh & Đổi mật khẩu hàng loạt"),
    bulletItem("• Thêm / Sửa học sinh:", "Thêm từng học sinh hoặc cập nhật thông tin cá nhân."),
    bulletItem("• Đổi mật khẩu HÀNG LOẠT (Batch Reset):", "Chọn Khối hoặc Lớp, nhập mật khẩu chung mới (Ví dụ: 123) và bấm xác nhận để cập nhật đồng loạt trong 1 giây."),
    bulletItem("• Xuất Excel danh sách học sinh:", "Xuất danh sách học sinh kèm thông tin tài khoản ra file Excel."),

    h2("3.7 Thống kê Kết quả & Cơ chế Xóa bài thi tức thì (Direct DOM Sync)"),
    bulletItem("• 4 Thẻ chỉ số KPI:", "Tổng số bài thi nộp, Điểm trung bình, Điểm cao nhất/thấp nhất, Tỉ lệ đạt (>= 5.0)."),
    bulletItem("• Phân trang thông minh:", "Hỗ trợ xem 60, 100, 200 hoặc Tất cả học sinh/trang, giúp bảng điểm tải siêu tốc không bị đơ giật."),
    bulletItem("• 'Hiện đủ danh sách lớp theo CSDL gốc':", "Tự động bổ sung những học sinh chưa làm bài vào bảng điểm (để trống điểm) để thầy cô đối chiếu và đôn đốc."),
    bulletItem("• Cơ chế Xóa bài thi tức thì (Direct DOM):", "Khi giáo viên bấm nút xóa bài [🗑️] của một học sinh, dòng bài thi lập tức chuyển sang trạng thái 'Chưa làm bài' (hoặc biến mất nếu lọc Đã làm) ngay trước mắt, cố định vĩnh viễn và đồng bộ lệnh xóa sạch khỏi Google Sheets."),

    new Paragraph({ children: [new PageBreak()] })
  );

  // =========================================================================
  // PHẦN IV: HƯỚNG DẪN TAB TỔNG HỢP ĐIỂM
  // =========================================================================
  sectionsChildren.push(
    h1("PHẦN IV: HƯỚNG DẪN TAB 'TỔNG HỢP ĐIỂM' (TRẮC NGHIỆM & TỰ LUẬN)"),
    h2("4.1 Ý nghĩa & Sự cần thiết của Phân hệ Tổng Hợp Điểm"),
    p("Trong các đề kiểm tra định kỳ hiện nay, bài thi thường kết hợp giữa 70% Trắc nghiệm (máy chấm tự động) và 30% Tự luận (giáo viên chấm tay). Việc ghép điểm thủ công từ hai nguồn này thường tốn rất nhiều thời gian và dễ xảy ra nhầm lẫn."),
    p("Tab 'Tổng Hợp Điểm' (tabSummaryScores) ra đời nhằm tự động hóa hoàn toàn quy trình này:"),
    bulletItem("•", "Lấy điểm Trắc nghiệm trực tiếp từ kết quả thi trực tuyến của học sinh."),
    bulletItem("•", "Tiếp nhận điểm Tự luận do giáo viên nhập từ file Excel."),
    bulletItem("•", "Hệ thống tự động so khớp theo Mã học sinh hoặc Họ tên + Lớp, tự động cộng Tổng Điểm = Điểm TN + Điểm TL."),
    bulletItem("•", "Đồng bộ điểm tổng hợp lên Google Sheets và xuất bảng điểm Excel chuẩn sổ điểm điện tử."),

    h2("4.2 Quy trình 3 bước sử dụng Tab Tổng Hợp Điểm"),
    bulletItem("Bước 1 - Tải File Mẫu Tự Luận (.xlsx):", "Tại Tab Tổng Hợp Điểm, bấm nút 'Tải File Mẫu Tự Luận (.xlsx)'. Hệ thống sẽ tự động xuất một file Excel chứa đầy đủ danh sách học sinh của lớp theo đúng thứ tự sổ điểm, kèm các cột điểm trắc nghiệm đã có và cột 'Điểm Tự Luận' để trống."),
    bulletItem("Bước 2 - Giáo viên chấm bài & Nhập điểm vào File Excel:", "Thầy/Cô mở file Excel vừa tải về, nhập điểm tự luận của từng học sinh vào cột Điểm Tự Luận và bấm lưu file."),
    bulletItem("Bước 3 - Nhập Điểm Tự Luận (Upload File):", "Quay lại Tab Tổng Hợp Điểm, bấm nút 'Nhập Điểm Tự Luận (Upload File)' và chọn file Excel vừa chấm xong. Hệ thống sẽ lập tức:"),
    bulletItem("   -", "Đọc dữ liệu điểm tự luận."),
    bulletItem("   -", "So khớp chính xác từng học sinh trong lớp."),
    bulletItem("   -", "Tự động tính Tổng Điểm (Thang 10)."),
    bulletItem("   -", "Cập nhật bảng điểm và đồng bộ lên Google Sheets máy chủ."),

    h2("4.3 Xuất Bảng Điểm Tổng Hợp (.xlsx)"),
    p("Bấm nút 'Xuất Excel Bảng Tổng Hợp (.xlsx)' để tải về bảng điểm chính thức phục vụ vào sổ điểm điện tử VnEdu, SMAS hoặc nộp Ban Giám Hiệu. Bảng điểm bao gồm đầy đủ các cột: STT, Lớp, Họ và Tên, Mã HS, Ngày sinh, Giới tính, Điểm TN, Điểm TL, Tổng Điểm, Số câu đúng và Thời gian nộp bài."),

    new Paragraph({ children: [new PageBreak()] })
  );

  // =========================================================================
  // PHẦN V: HƯỚNG DẪN CHI TIẾT DÀNH CHO HỌC SINH
  // =========================================================================
  sectionsChildren.push(
    h1("PHẦN V: HƯỚNG DẪN CHI TIẾT DÀNH CHO HỌC SINH (PHÒNG THI TRỰC TUYẾN)"),
    p("Cổng Học Sinh (student_dashboard.html) được thiết kế tối giản, trực quan và tích hợp các công nghệ bảo vệ bài thi tiên tiến nhất."),

    h2("5.1 Đăng nhập & Lưu ý Sống còn về Chọn Thầy/Cô phụ trách"),
    bulletItem("1.", "Truy cập trang đăng nhập (index.html), giữ vai trò là 'Học sinh'."),
    bulletItem("2. BẮT BUỘC CHỌN ĐÚNG THẦY/CÔ PHỤ TRÁCH:", "Tại mục '⚠️ THẦY / CÔ PHỤ TRÁCH PHÒNG THI', bấm danh sách thả xuống và CHỌN ĐÚNG TÊN GIÁO VIÊN đang dạy lớp mình."),
    bulletItem("3.", "Nhập Tài khoản học sinh (Mã HS) và Mật khẩu > Bấm 'Đăng Nhập'."),

    calloutBox("CẢNH BÁO NGUY HIỂM VỀ CHỌN SAI THẦY/CÔ", [
      "Học sinh BẮT BUỘC phải chọn đúng tên Thầy/Cô phụ trách lớp mình.",
      "Nếu chọn sai giáo viên: Học sinh sẽ không thể đăng nhập hoặc bài làm bị gửi sang máy chủ khác, dẫn tới mất bài thi và bị tính 0 điểm!",
      "Mẹo: Nếu Thầy/Cô gửi link trực tiếp có chứa mã phòng thi, hệ thống sẽ tự động chọn đúng giáo viên mà học sinh không cần chọn thủ công."
    ], "danger"),

    h2("5.2 Giao diện Phòng thi & Bảng câu hỏi thông minh"),
    bulletItem("• Đồng hồ đếm ngược:", "Hiển thị chính xác từng giây thời gian còn lại. Đổi màu đỏ cảnh báo khi còn dưới 5 phút. Khi hết giờ, hệ thống TỰ ĐỘNG THU VÀ NỘP BÀI."),
    bulletItem("• Bảng điều hướng câu hỏi:", "Cột bên phải hiển thị trạng thái từng câu: Màu xám (chưa làm), Màu xanh lá (đã hoàn thành). Bấm vào số câu để cuộn nhanh đến câu hỏi đó."),

    h2("5.3 Tính năng Độc quyền: CHỐNG NHÌN TRỘM TỰ LUẬN (Anti-Peep Mode)"),
    p("Khi làm bài tự luận trong phòng máy tính hoặc lớp học có vị trí ngồi gần nhau, học sinh bên cạnh rất dễ nhìn trộm nội dung đang gõ. EduTest Pro 2.0 đã tiên phong ứng dụng cơ chế chống nhìn trộm độc đáo:"),
    bulletItem("• Cơ chế tự động gạch ngang & thu nhỏ chữ:", "Khi học sinh gõ văn bản vào khung tự luận, các ký tự sẽ tự động được gạch ngang ở giữa (strikethrough) và kích thước chữ được thu nhỏ vừa phải. Học sinh bên cạnh nhìn vào sẽ hoàn toàn không thể đọc được nội dung!"),
    bulletItem("• Nút con mắt 👁️ xem lại bài:", "Tại góc phải của mỗi khung câu hỏi tự luận có nút hình Con mắt 👁️. Học sinh chỉ cần nhấp vào nút con mắt để tạm thời bỏ gạch ngang, đưa chữ về kích thước bình thường để rà soát lại bài làm của mình. Nhấp lại một lần nữa để tiếp tục che bài."),

    h2("5.4 Cơ chế Giám sát Chống gian lận Nâng cao (Anti-Cheat 2.0)"),
    bulletItem("• Bắt buộc toàn màn hình (Fullscreen):", "Học sinh bắt buộc phải phóng to toàn màn hình khi làm bài kiểm tra chính thức."),
    bulletItem("• Phát hiện gian lận đa tầng:", "Hệ thống phát hiện ngay lập tức các hành vi: Nhấn phím Esc, thu nhỏ cửa sổ trình duyệt, chuyển đổi tab hoặc mở tab mới để tra cứu tài liệu trên Google."),
    bulletItem("• Bịt kín lỗ hổng Nộp bài - Hủy bỏ:", "Trong các phiên bản trước, học sinh có thể lợi dụng việc bấm Nộp bài rồi bấm Hủy để thoát màn hình mà không bị cảnh báo. Bản EduTest Pro 2.0 đã bịt kín hoàn toàn lỗ hổng này: Dù học sinh có hủy hộp thoại nộp bài, màn hình vẫn duy trì chế độ giám sát nghiêm ngặt."),
    bulletItem("• Nộp bài cưỡng chế khi vi phạm quá mức:", "Nếu số lần vi phạm vượt quá mức quy định của đề thi (ví dụ quá 5 lần), hệ thống sẽ TỰ ĐỘNG KHÓA VÀ NỘP BÀI NGAY LẬP TỨC!"),

    new Paragraph({ children: [new PageBreak()] })
  );

  // =========================================================================
  // PHẦN VI: KIẾN TRÚC MÁY CHỦ PHÂN TÁN & CENTRAL HUB
  // =========================================================================
  sectionsChildren.push(
    h1("PHẦN VI: MÔ HÌNH TRẠM TRUNG TÂM (CENTRAL HUB) & MÁY CHỦ PHÂN TÁN"),
    h2("6.1 Giải bài toán nghẽn mạng cho trường học quy mô lớn"),
    p("Khi toàn trường tổ chức kiểm tra đồng loạt cho 1.000 đến 2.000 học sinh cùng lúc, nếu tất cả truy cập vào 1 file Google Sheet duy nhất sẽ dẫn tới nghẽn mạng do vượt quá giới hạn (Quota) của Google Apps Script."),
    p("EduTest Pro 2.0 giải quyết bài toán này bằng kiến trúc Trạm Trung Tâm phân tán cực kỳ thông minh:"),
    bulletItem("• Trạm Trung Tâm (Central Hub Server):", "Đóng vai trò điều phối viên, lưu danh bạ giáo viên và đường dẫn Web App của từng giáo viên trong trường."),
    bulletItem("• Máy chủ Giáo viên Độc lập (Teacher Personal Servers):", "Mỗi giáo viên sở hữu 1 Google Sheet riêng. Đề thi, danh sách học sinh và kết quả chấm điểm của lớp nào nằm hoàn toàn trên Google Sheet của giáo viên lớp đó."),
    bulletItem("• Tự động Định tuyến (Smart Dynamic Routing):", "Học sinh đăng nhập trang chung, hệ thống tự động nhận diện học sinh thuộc giáo viên nào và chuyển hướng an toàn về máy chủ của giáo viên đó mà học sinh không hề nhận thấy sự chuyển tiếp."),

    h2("6.2 Quy trình Đồng bộ Dữ liệu lên Trạm Trung Tâm"),
    bulletItem("Bước 1:", "Giáo viên hoàn thiện danh sách học sinh các lớp mình phụ trách tại Google Sheet cá nhân."),
    bulletItem("Bước 2:", "Tại Cổng Giáo Viên > Tab 'Quản Lý Học Sinh', bấm nút '🌐 Đồng bộ Trạm Trung Tâm'."),
    bulletItem("Bước 3:", "Hệ thống tự động gửi danh bạ mã học sinh của Thầy/Cô lên bảng HUB_STUDENTS của Trạm Trung Tâm."),
    bulletItem("Bước 4:", "Từ đây, học sinh của Thầy/Cô có thể đăng nhập thông suốt từ bất kỳ đâu!"),

    new Paragraph({ children: [new PageBreak()] })
  );

  // =========================================================================
  // PHẦN VII: CÁC TIỆN ÍCH ĐẶC BIỆT
  // =========================================================================
  sectionsChildren.push(
    h1("PHẦN VII: CÁC TIỆN ÍCH ĐẶC BIỆT: NHẠC NỀN & ĐA NỀN TẢNG"),
    h2("7.1 Widget Nhạc Nền Thư Giãn Phòng Thi & Cấu hình Âm lượng Thông minh"),
    p("Âm nhạc du dương êm dịu giúp học sinh giải tỏa căng thẳng tâm lý phòng thi, tăng khả năng tập trung và sáng tạo khi làm bài. EduTest Pro 2.0 tích hợp sẵn widget nghe nhạc độc đáo:"),
    bulletItem("• Vị trí tinh tế:", "Nút biểu tượng Cái Loa nhỏ gọn nằm ở góc trên bên phải thanh điều hướng, có chấm đèn xanh báo sóng khi đang phát."),
    bulletItem("• Danh sách 3 ca khúc bất hủ phát ngẫu nhiên:"),
    bulletItem("   1) Woman in Love (Barbra Streisand):", "Tự động phát ở mức âm lượng 50% du dương."),
    bulletItem("   2) Love Story (Taylor Swift):", "Tự động phát ở mức âm lượng 30% êm dịu."),
    bulletItem("   3) Sealed With a Kiss (Brian Hyland):", "Tự động phát ở mức âm lượng 30% êm dịu."),
    bulletItem("• Cơ chế Âm lượng Thông minh cho từng bài:", "Mỗi khi chuyển bài (Next / Shuffle), hệ thống tự động đổi âm lượng về đúng mức chuẩn của bài đó (Woman in Love tự lên 50%, hai bài còn lại tự về 30%)."),
    bulletItem("• Bảng điều khiển Pop-up đầy đủ tiện ích:", "Nút Play/Pause, Nút đổi bài nhanh, Nút Mute (tắt tiếng), Thanh trượt kéo âm lượng từ 0 - 100% và 4 nấc chọn nhanh: 15% (Nhẹ), 30% (Chuẩn), 50% (Vừa), 80% (To)."),

    h2("7.2 Trải nghiệm Đáp ứng Đa nền tảng (Responsive Design)"),
    bulletItem("• Máy tính để bàn & Laptop:", "Giao diện 2 cột hiện đại, bảng điều hướng câu hỏi bám dính (sticky) tiện lợi khi cuộn trang."),
    bulletItem("• Điện thoại Smartphone & Máy tính bảng:", "Bảng câu hỏi chuyển thành ngăn kéo trượt (Mobile Drawer) mượt mà, thanh điều hướng đáy (Bottom Navigation) tiện lợi, diện tích chạm nút bấm đạt chuẩn công thái học."),

    new Paragraph({ children: [new PageBreak()] })
  );

  // =========================================================================
  // PHẦN VIII: CÂU HỎI THƯỜNG GẶP (FAQ) & XỬ LÝ SỰ CỐ
  // =========================================================================
  sectionsChildren.push(
    h1("PHẦN VIII: BẢNG TỔNG HỢP CÂU HỎI THƯỜNG GẶP (FAQ) & XỬ LÝ SỰ CỐ"),
    h2("8.1 Học sinh báo lỗi không đăng nhập được?"),
    bulletItem("1. Chưa chọn đúng Thầy/Cô:", "Nhắc học sinh bấm chọn đúng tên Thầy/Cô phụ trách lớp mình."),
    bulletItem("2. Sai tài khoản / mật khẩu:", "Kiểm tra lại mã học sinh trong Google Sheet (DATA_HOCSINH). Sử dụng tính năng Cấp lại mật khẩu hoặc Đổi mật khẩu hàng loạt nếu học sinh quên."),
    bulletItem("3. Chưa cấp quyền Anyone:", "Kiểm tra lại bản Deploy Web App trên Apps Script, đảm bảo mục 'Who has access' đã chọn 'Anyone'."),

    h2("8.2 Bị mất điện hoặc rớt mạng khi đang làm bài thi?"),
    bulletItem("• Lưu vết liên tục:", "Toàn bộ câu trả lời học sinh đã tích được tự động lưu tạm trên bộ nhớ Local Storage của máy tính/điện thoại."),
    bulletItem("• Phục hồi tức thì:", "Khi có mạng hoặc điện trở lại, học sinh tải lại trang web là tiếp tục làm bài ngay mà không bị mất các câu trả lời trước đó."),
    bulletItem("• Đồng bộ thời gian thực:", "Đồng hồ đếm ngược được tính theo mốc thời gian máy chủ, đảm bảo công bằng cho tất cả thí sinh."),

    h2("8.3 Cách cho một học sinh thi lại khi gặp sự cố bất khả kháng?"),
    bulletItem("• Bước 1:", "Giáo viên vào Tab 'Xem Kết Quả & Thống Kê', chọn đúng Đề thi và Lớp học."),
    bulletItem("• Bước 2:", "Tìm tên học sinh đó trong bảng điểm, bấm nút thùng rác đỏ [🗑️]."),
    bulletItem("• Bước 3:", "Xác nhận xóa. Dòng bài thi lập tức chuyển thành 'Chưa làm bài' và Google Sheets được xóa sạch. Học sinh có thể đăng nhập vào phòng thi làm lại bình thường."),

    h2("8.4 Làm sao để học sinh không nhìn thấy đề thi trước giờ kiểm tra?"),
    bulletItem("•", "Trong quá trình soạn đề, luôn để công tắc 'Trạng thái kỳ thi' ở chế độ ĐÓNG."),
    bulletItem("•", "Đúng đến giờ kiểm tra, Thầy/Cô chỉ cần gạt công tắc sang MỞ. Ngay lập tức đề thi sẽ xuất hiện trên màn hình của học sinh."),

    h2("8.5 Tài khoản Ban Giám Hiệu (BGH) khác gì tài khoản Giáo Viên?"),
    bulletItem("•", "Tài khoản BGH được xem thống kê toàn trường của tất cả giáo viên và tất cả các lớp."),
    bulletItem("•", "Tài khoản BGH ở chế độ CHỈ XEM, hệ thống ẩn hoàn toàn nút Sửa đề, Xóa đề và Xóa bài thi để đảm bảo tính khách quan tuyệt đối."),

    new Paragraph({ children: [new PageBreak()] })
  );

  // =========================================================================
  // PHẦN IX: THÔNG TIN LIÊN HỆ & BẢN QUYỀN
  // =========================================================================
  sectionsChildren.push(
    h1("PHẦN IX: THÔNG TIN TÁC GIẢ, BẢN QUYỀN & HỖ TRỢ KỸ THUẬT"),
    p("Hệ thống EduTest Pro 2.0 được nghiên cứu và phát triển bởi Thầy Nguyễn Phi Hùng với tâm huyết đóng góp một công cụ khảo thí hiện đại, mạnh mẽ, công bằng và hoàn toàn miễn phí cho cộng đồng giáo dục Việt Nam."),
    
    calloutBox("THÔNG TIN LIÊN HỆ VÀ HỖ TRỢ KỸ THUẬT CHUYÊN MÔN", [
      "• Tác giả phát triển: Thầy NGUYỄN PHI HÙNG",
      "• Số điện thoại / Zalo tư vấn & hỗ trợ kỹ thuật: 0938.750.424",
      "• Lĩnh vực hỗ trợ: Cài đặt hệ thống, tích hợp AI bóc tách đề, chuyển giao công nghệ cho tổ chuyên môn, tùy biến theo yêu cầu riêng của nhà trường.",
      "• Giấy phép phát hành: Phần mềm mã nguồn mở phục vụ phi thương mại cho các trường học và thầy cô giáo trên toàn quốc."
    ], "success"),

    new Paragraph({ spacing: { before: 180, after: 80 } }),
    p("Kính chúc quý Thầy Cô có những trải nghiệm giảng dạy và kiểm tra đánh giá hiệu quả, chúc các em học sinh luôn tự tin và đạt kết quả xuất sắc trong học tập!", {
      italics: true,
      alignment: AlignmentType.CENTER,
      color: COLOR.PRIMARY,
      size: 24,
      bold: true
    })
  );

  // Khởi tạo Document
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: "Arial",
            size: 22,
            color: COLOR.DARK_TEXT
          }
        }
      }
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1440,    // 1 inch = 1440 twips
            bottom: 1440,
            left: 1440,
            right: 1440
          }
        }
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { before: 0, after: 120 },
              children: [
                new TextRun({
                  text: "EduTest Pro 2.0 - Tài liệu Hướng dẫn Sử dụng Chi tiết (Bản Full 2026)",
                  font: "Arial",
                  size: 16,
                  italics: true,
                  color: COLOR.MUTED_TEXT
                })
              ]
            })
          ]
        })
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { before: 120, after: 0 },
              children: [
                new TextRun({
                  text: "Tác giả: Nguyễn Phi Hùng (0938.750.424)  |  Trang ",
                  font: "Arial",
                  size: 16,
                  color: COLOR.MUTED_TEXT
                }),
                new TextRun({
                  children: [PageNumber.CURRENT],
                  font: "Arial",
                  size: 16,
                  bold: true,
                  color: COLOR.PRIMARY
                }),
                new TextRun({
                  text: " / ",
                  font: "Arial",
                  size: 16,
                  color: COLOR.MUTED_TEXT
                }),
                new TextRun({
                  children: [PageNumber.TOTAL_PAGES],
                  font: "Arial",
                  size: 16,
                  bold: true,
                  color: COLOR.PRIMARY
                })
              ]
            })
          ]
        })
      },
      children: sectionsChildren
    }]
  });

  console.log("Dang xuat file docx qua Packer...");
  const buffer = await Packer.toBuffer(doc);
  const outputPath = path.join(__dirname, "Huong_Dan_Su_Dung_EduTest_Pro_2.0.docx");
  fs.writeFileSync(outputPath, buffer);
  console.log("XUAT THANH CONG! File duoc luu tai:", outputPath);
  console.log("Kich thuoc file:", (buffer.length / 1024).toFixed(2), "KB");
}

generateDocx().catch(err => {
  console.error("LOI KHI TAO FILE DOCX:", err);
  process.exit(1);
});
