/**
 * ============================================================================
 * SCRIPT TẠO FILE HUONG_DAN_HOC_SINH_EDUTEST_PRO_2.0.DOCX
 * Bản hướng dẫn chi tiết dành riêng cho Học sinh tham gia thi trực tuyến
 * Đầy đủ 100% chức năng mới nhất:
 *   - Chọn đúng Thầy/Cô phụ trách phòng thi
 *   - Làm 3 dạng câu hỏi: Trắc nghiệm 4 lựa chọn, Trắc nghiệm Đúng/Sai 4 ý, Tự luận
 *   - Tính năng độc quyền: CHỐNG NHÌN TRỘM TỰ LUẬN (Anti-Peep Mode: gạch ngang & nút 👁️)
 *   - Cơ chế Giám sát Chống gian lận 2.0 (Fullscreen, bịt lỗ hổng Nộp bài - Cancel)
 *   - Widget Nhạc nền thư giãn: Woman in Love (50%), Love Story (30%), Sealed With a Kiss (30%)
 *   - Tự động lưu bài khi rớt mạng/mất điện (Auto-save LocalStorage)
 *   - Bảng câu hỏi di động (Mobile Drawer) & Hướng dẫn xử lý sự cố phòng thi
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

// Bảng màu thiết kế chuyên nghiệp dành cho học sinh
const COLOR = {
  PRIMARY: "1E3A8A",      // Xanh Navy đậm (Tiêu đề chính)
  SECONDARY: "2563EB",    // Xanh Royal Blue (Tiêu đề phụ, nhấn mạnh)
  ACCENT_GREEN: "059669", // Xanh ngọc lục bảo (Thành công, Đúng, Tự luận)
  ACCENT_AMBER: "D97706", // Vàng hổ phách (Lưu ý, Cảnh báo)
  ACCENT_RED: "DC2626",   // Đỏ ruby (Cảnh báo nguy hiểm, Gian lận)
  ACCENT_CYAN: "0284C7",  // Xanh dương sáng (Widget nhạc, Mobile)
  DARK_TEXT: "1E293B",    // Xám đen đậm (Nội dung chính)
  MUTED_TEXT: "64748B",   // Xám trung tính (Ghi chú, phụ đề)
  LIGHT_BG: "F8FAFC",     // Nền xám rất nhạt
  LIGHT_BLUE: "EFF6FF",   // Nền xanh nhạt
  LIGHT_GREEN: "ECFDF5",  // Nền xanh lá nhạt
  LIGHT_AMBER: "FFFBEB",  // Nền vàng nhạt
  LIGHT_RED: "FEF2F2",    // Nền đỏ nhạt
  BORDER_LIGHT: "CBD5E1", // Viền xám nhạt
  WHITE: "FFFFFF"
};

// Helper tạo Paragraph văn bản chuẩn
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
      line: opts.line || 276
    },
    children: opts.children || runs,
    bullet: opts.bullet || undefined
  });
}

// Helper tạo Paragraph dạng danh sách (Bullet)
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
  } else if (type === "music") {
    borderColor = COLOR.ACCENT_CYAN;
    bgFill = "F0F9FF";
    titleColor = "0369A1";
    icon = "🎵";
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

// Helper tạo Bảng dữ liệu chuẩn
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

// XÂY DỰNG TÀI LIỆU HƯỚNG DẪN HỌC SINH
async function generateStudentDocx() {
  console.log("Bat dau khoi tao Huong Dan Hoc Sinh EduTest Pro 2.0...");

  // Ảnh bìa nếu có
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
          text: "HỆ THỐNG THI & KIỂM TRA TRỰC TUYẾN THÔNG MINH EDUTEST PRO 2.0",
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
          text: "CẨM NANG HƯỚNG DẪN CHI TIẾT",
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
          text: "DÀNH CHO HỌC SINH THAM GIA THI TRỰC TUYẾN",
          font: "Arial",
          size: 36,
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
          text: "ĐĂNG NHẬP ĐÚNG PHÒNG THI • CHỐNG NHÌN TRỘM TỰ LUẬN • CHỐNG GIAN LẬN TOÀN MÀN HÌNH • NỘP BÀI AN TOÀN",
          font: "Arial",
          size: 19,
          bold: true,
          color: "0F766E"
        })
      ]
    })
  );

  // Chèn ảnh minh họa
  if (imageRunInstance) {
    sectionsChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80, after: 200 },
        children: [imageRunInstance]
      })
    );
  }

  // Bảng cấu hình mẫu & thông tin thí sinh trên trang bìa
  const coverTable = new Table({
    width: { size: 92, type: WidthType.PERCENTAGE },
    alignment: AlignmentType.CENTER,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 34, type: WidthType.PERCENTAGE },
            shading: { fill: COLOR.LIGHT_BG },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              left: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              right: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT }
            },
            children: [p("Thầy / Cô phụ trách phòng thi mẫu:", { bold: true, color: COLOR.PRIMARY })]
          }),
          new TableCell({
            width: { size: 66, type: WidthType.PERCENTAGE },
            shading: { fill: COLOR.WHITE },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              left: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              right: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT }
            },
            children: [p("Thầy NGUYỄN PHI HÙNG - Thầy 5C", { bold: true, color: COLOR.DARK_TEXT })]
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: 34, type: WidthType.PERCENTAGE },
            shading: { fill: COLOR.LIGHT_BG },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              left: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              right: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT }
            },
            children: [p("Tài khoản học sinh thử nghiệm:", { bold: true, color: COLOR.PRIMARY })]
          }),
          new TableCell({
            width: { size: 66, type: WidthType.PERCENTAGE },
            shading: { fill: COLOR.WHITE },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              left: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              right: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT }
            },
            children: [p("demohs  (Mật khẩu mặc định: 1234)", { bold: true, color: COLOR.SECONDARY })]
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: 34, type: WidthType.PERCENTAGE },
            shading: { fill: COLOR.LIGHT_BG },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              left: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              right: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT }
            },
            children: [p("Thiết bị hỗ trợ làm bài:", { bold: true, color: COLOR.PRIMARY })]
          }),
          new TableCell({
            width: { size: 66, type: WidthType.PERCENTAGE },
            shading: { fill: COLOR.WHITE },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              left: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              right: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT }
            },
            children: [p("Máy tính để bàn (PC), Laptop, Máy tính bảng (iPad/Android), Điện thoại Smartphone", { color: COLOR.DARK_TEXT })]
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: 34, type: WidthType.PERCENTAGE },
            shading: { fill: COLOR.LIGHT_BG },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              left: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              right: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT }
            },
            children: [p("Hỗ trợ kỹ thuật phòng thi (Zalo/ĐT):", { bold: true, color: COLOR.PRIMARY })]
          }),
          new TableCell({
            width: { size: 66, type: WidthType.PERCENTAGE },
            shading: { fill: COLOR.WHITE },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              left: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              right: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT }
            },
            children: [p("0938.750.424 (Thầy Nguyễn Phi Hùng)", { bold: true, color: "047857" })]
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
          text: "HỌC SINH ĐỌC KỸ TÀI LIỆU TRƯỚC KHI BẮT ĐẦU VÀO PHÒNG THI CHÍNH THỨC",
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
    h1("MỤC LỤC TÀI LIỆU HƯỚNG DẪN HỌC SINH"),
    p("Tài liệu hướng dẫn bao gồm 9 phần chi tiết bám sát trải nghiệm thực tế của học sinh trong phòng thi:"),
    bulletItem("Phần 1:", "Hướng Dẫn Đăng Nhập Đúng Quy Chuẩn & Lưu Ý Bắt Buộc Chọn Đúng Thầy/Cô"),
    bulletItem("Phần 2:", "Giao Diện Bảng Điều Khiển Học Sinh (Student Dashboard) & Kiểm Tra Thông Tin"),
    bulletItem("Phần 3:", "Quy Trình Vào Phòng Thi & Thao Tác Bắt Đầu Làm Bài"),
    bulletItem("Phần 4:", "Hướng Dẫn Làm 3 Dạng Câu Hỏi: Trắc Nghiệm 4 Lựa Chọn, Đúng/Sai 4 Ý & Tự Luận"),
    bulletItem("Phần 5:", "Tính Năng Độc Quyền: CHỐNG NHÌN TRỘM BÀI LÀM TỰ LUẬN (Anti-Peep Mode)"),
    bulletItem("Phần 6:", "Quy Chế Giám Sát Phòng Thi & Cơ Chế Chống Gian Lận Nâng Cao (Anti-Cheat 2.0)"),
    bulletItem("Phần 7:", "Rà Soát Câu Hỏi Chưa Làm, Nộp Bài Thi & Màn Hình Vinh Danh Kết Quả"),
    bulletItem("Phần 8:", "Widget Nhạc Nền Thư Giãn, Đổi Mật Khẩu Cá Nhân & Quản Lý Tài Khoản"),
    bulletItem("Phần 9:", "Bảng Tổng Hợp Sự Cố Thường Gặp & Cách Khắc Phục Nhanh Khi Đang Làm Bài"),
    new Paragraph({ spacing: { before: 120, after: 120 } }),
    calloutBox("THÔNG ĐIỆP DÀNH CHO CÁC EM HỌC SINH", [
      "Hệ thống EduTest Pro 2.0 được xây dựng nhằm tạo ra một phòng thi trực tuyến hiện đại, công bằng, bảo mật và tiện lợi nhất cho các em.",
      "Để bài thi được nộp đúng về sổ điểm của lớp và không bị gián đoạn, các em hãy đọc kỹ từng bước hướng dẫn trong tài liệu này trước khi vào phòng thi nhé!"
    ], "success"),
    new Paragraph({ children: [new PageBreak()] })
  );

  // =========================================================================
  // PHẦN 1: HƯỚNG DẪN ĐĂNG NHẬP HỆ THỐNG
  // =========================================================================
  sectionsChildren.push(
    h1("PHẦN 1: HƯỚNG DẪN ĐĂNG NHẬP HỆ THỐNG ĐÚNG QUY CHUẨN"),
    p("Để đảm bảo quyền lợi và bài thi được nộp chính xác về sổ điểm của lớp học, các em học sinh cần thực hiện nghiêm túc 3 bước đăng nhập tuần tự dưới đây:"),

    h2("1.1 Bước 1: Mở trình duyệt & Truy cập trang đăng nhập"),
    p("Học sinh mở trình duyệt web trên máy tính hoặc điện thoại (khuyến nghị dùng Google Chrome, Microsoft Edge, Cốc Cốc hoặc Safari) và truy cập đường link trang thi do nhà trường/thầy cô cung cấp."),
    bulletItem("• Kiểm tra vai trò đăng nhập:", "Hệ thống mặc định chọn sẵn vai trò 'Học sinh' (tab màu xanh lam). Nếu đang ở vai trò khác, các em bấm chuột vào tab 'Học sinh'."),

    h2("1.2 Bước 2 (CỰC KỲ QUAN TRỌNG): Chọn đúng Thầy/Cô phụ trách phòng thi"),
    calloutBox("🚨 CẢNH BÁO BẮT BUỘC TỪ HỆ THỐNG PHÒNG THI", [
      "Học sinh BẮT BUỘC phải nhấp vào ô 'THẦY / CÔ PHỤ TRÁCH PHÒNG THI (*)' và chọn đúng tên Giáo viên đang giảng dạy bộ môn lớp mình.",
      "Ví dụ đối với lớp Thầy Hùng: Nhấp chọn dòng '👨‍🏫 Nguyễn Phi Hùng - Thầy 5C (THCS An Nhơn - Trụ sở chính)'.",
      "❌ NẾU KHÔNG CHỌN HOẶC CHỌN SAI: Hệ thống sẽ chặn đăng nhập hoặc nếu nộp nhầm sang máy chủ giáo viên khác, bài thi của bạn sẽ KHÔNG CÓ TRONG SỔ ĐIỂM CỦA LỚP dẫn tới BỊ 0 ĐIỂM!",
      "💡 Mẹo hay: Nếu Thầy/Cô gửi đường link có sẵn mã phòng thi, hệ thống sẽ tự động chọn đúng Thầy/Cô mà em không cần chọn thủ công."
    ], "danger"),
    p("Sau khi chọn đúng Thầy/Cô, hệ thống sẽ hiện khung màu xanh lá cây xác nhận kết nối thành công: '✅ Đang kết nối phòng thi: Nguyễn Phi Hùng - Thầy 5C..."),

    h2("1.3 Bước 3: Nhập thông tin tài khoản và mật khẩu học sinh"),
    createTable(
      ["Trường thông tin", "Giá trị minh họa", "Ghi chú hướng dẫn"],
      [
        ["Tài khoản học sinh", "demohs (hoặc mã HS của em)", "Nhập mã học sinh do Thầy/Cô cấp (không phân biệt chữ hoa/thường)"],
        ["Mật khẩu", "1234 (hoặc mật khẩu của em)", "Nhập đúng mật khẩu (bấm biểu tượng con mắt để xem rõ)"],
        ["Hành động", "Bấm nút 'Đăng Nhập'", "Hệ thống sẽ xác thực trực tiếp và chuyển vào phòng thi trong 1 giây"]
      ],
      [28, 32, 40]
    ),

    new Paragraph({ children: [new PageBreak()] })
  );

  // =========================================================================
  // PHẦN 2: BẢNG ĐIỀU KHIỂN HỌC SINH
  // =========================================================================
  sectionsChildren.push(
    h1("PHẦN 2: GIAO DIỆN BẢNG ĐIỀU KHIỂN HỌC SINH (STUDENT DASHBOARD)"),
    p("Sau khi đăng nhập thành công, màn hình Bảng điều khiển học sinh (student_dashboard.html) sẽ xuất hiện với đầy đủ thông tin:"),

    h2("2.1 Thẻ thông tin cá nhân của học sinh"),
    bulletItem("• Lời chào thí sinh:", "Hiển thị họ và tên của em (Ví dụ: Xin chào HS DEMO!)."),
    bulletItem("• Mã học sinh:", "Mã định danh duy nhất của em (Ví dụ: DEMOHS)."),
    bulletItem("• Lớp học & Trường học:", "Hiển thị lớp học và trường học đang theo học (Ví dụ: Lớp 9A1 - THCS An Nhơn)."),
    bulletItem("• Ngày sinh & Giới tính:", "Thông tin ngày sinh và giới tính theo sổ điểm gốc."),
    calloutBox("LƯU Ý ĐỐI CHIẾU THÔNG TIN", [
      "Học sinh cần kiểm tra lại xem thông tin hiển thị trên màn hình có đúng là của mình không.",
      "Nếu phát hiện sai sót (sai lớp, sai ngày sinh...), hãy báo ngay cho Thầy/Cô giáo để được điều chỉnh kịp thời."
    ], "warning"),

    h2("2.2 Danh sách các kỳ thi đang mở cho lớp"),
    p("Hệ thống EduTest Pro 2.0 phân biệt 2 loại bài thi với màu sắc và quy chế rõ ràng:"),
    bulletItem("1. Chế độ Ôn tập / Luyện tập (📖 Màu xanh lá):", "Cho phép học sinh làm bài nhiều lần để rèn luyện kỹ năng. Điểm số hệ thống sẽ ghi nhận kết quả của lần nộp bài cuối cùng. Sau khi nộp, học sinh được xem lại toàn bộ bài làm và đáp án chi tiết từng câu."),
    bulletItem("2. Chế độ Thi / Kiểm tra chính thức (🔒 Màu vàng/đỏ):", "Chỉ cho phép học sinh làm bài 1 LẦN DUY NHẤT. Khi đã nộp bài, đề thi sẽ tự động khóa chuyển sang trạng thái 'Đã Nộp Bài (Chỉ thi 1 lần)' và không thể làm lại."),

    h2("2.3 Menu tài khoản cá nhân & Đổi mật khẩu"),
    bulletItem("• Xem hồ sơ:", "Bấm vào tên tài khoản ở góc trên bên phải để xem thông tin chi tiết."),
    bulletItem("• Tự đổi mật khẩu:", "Học sinh có thể tự đặt mật khẩu riêng cho mình để bảo vệ tài khoản, tránh trường hợp bạn khác vào nhầm tài khoản."),
    bulletItem("• Đăng xuất an toàn:", "Bấm 'Đăng xuất' sau khi hoàn thành buổi thi, đặc biệt là khi ngồi làm bài tại phòng máy tính của trường hoặc mượn thiết bị của bạn."),

    new Paragraph({ children: [new PageBreak()] })
  );

  // =========================================================================
  // PHẦN 3: QUY TRÌNH VÀO PHÒNG THI
  // =========================================================================
  sectionsChildren.push(
    h1("PHẦN 3: QUY TRÌNH VÀO PHÒNG THI & THAO TÁC LÀM BÀI"),
    p("Để bắt đầu làm bài, học sinh bấm nút **'Bắt Đầu Làm Bài'** (hoặc 'Vào Ôn Luyện') trên thẻ bài thi tương ứng."),

    h2("3.1 Tổng quan bố cục phòng thi tập trung"),
    p("Giao diện phòng thi trực tuyến của EduTest Pro 2.0 được thiết kế khoa học với 3 khu vực chính:"),
    bulletItem("1. Thanh Header dính trên cùng (Sticky Header):", "Hiển thị tên kỳ thi, mã đề, trạng thái phòng thi, Đồng hồ đếm ngược thời gian và nút 'Nộp Bài'."),
    bulletItem("2. Cột bên trái (Khung đề thi):", "Khu vực hiển thị nội dung câu hỏi, hình ảnh minh họa (nếu có) và các phương án trả lời."),
    bulletItem("3. Cột bên phải (Bảng điều hướng câu hỏi - Question Palette):", "Hiển thị danh sách toàn bộ số câu hỏi trong đề thi. Bấm vào bất kỳ số câu nào, màn hình sẽ tự động cuộn nhanh tới câu đó."),

    h2("3.2 Đồng hồ đếm ngược thông minh (Countdown Timer)"),
    bulletItem("•", "Đồng hồ hiển thị thời gian còn lại chính xác từng giây."),
    bulletItem("•", "Khi thời gian làm bài còn dưới 5 phút, đồng hồ sẽ chuyển sang màu đỏ cảnh báo nhấp nháy để nhắc nhở học sinh khẩn trương rà soát lại bài."),
    bulletItem("•", "Khi thời gian đếm ngược về 00:00: Hệ thống sẽ TỰ ĐỘNG THU VÀ NỘP BÀI LÊN MÁY CHỦ ngay lập tức, học sinh không lo bị mất bài!"),

    h2("3.3 Bảng điều hướng câu hỏi (Question Palette)"),
    bulletItem("• Màu xám nhạt:", "Câu hỏi chưa làm."),
    bulletItem("• Màu xanh dương / xanh lá đậm:", "Câu hỏi đã hoàn thành."),
    bulletItem("• Trên điện thoại di động:", "Bảng câu hỏi được thiết kế thành Ngăn kéo trượt (Mobile Drawer) thông minh. Học sinh bấm nút 'Bảng câu hỏi' ở góc dưới để mở bảng chọn câu nhanh chóng."),

    new Paragraph({ children: [new PageBreak()] })
  );

  // =========================================================================
  // PHẦN 4: HƯỚNG DẪN LÀM 3 DẠNG CÂU HỎI
  // =========================================================================
  sectionsChildren.push(
    h1("PHẦN 4: HƯỚNG DẪN LÀM 3 DẠNG CÂU HỎI CHUẨN BỘ GD&ĐT"),
    p("Đề thi trong EduTest Pro 2.0 bám sát 100% cấu trúc định dạng đề thi mới của Bộ Giáo dục & Đào tạo gồm 3 phần:"),

    h2("4.1 Phần I: Câu hỏi Trắc nghiệm nhiều lựa chọn (4 phương án)"),
    bulletItem("• Đặc điểm:", "Mỗi câu hỏi có 4 phương án lựa chọn A, B, C, D (chỉ có duy nhất 1 phương án đúng)."),
    bulletItem("• Cách trả lời:", "Học sinh nhấp chuột hoặc chạm tay vào phương án mình cho là đúng nhất. Phương án được chọn sẽ sáng lên với viền xanh lam nổi bật."),
    bulletItem("• Đổi đáp án:", "Nếu muốn thay đổi câu trả lời, các em chỉ cần nhấp vào phương án khác bất kỳ lúc nào trước khi nộp bài."),

    h2("4.2 Phần II: Câu hỏi Trắc nghiệm Đúng / Sai (4 ý a, b, c, d)"),
    bulletItem("• Đặc điểm:", "Mỗi câu hỏi có một ngữ cảnh chung và 4 ý khẳng định a, b, c, d. Trong mỗi ý, học sinh phải chọn 'Đúng' hoặc 'Sai'."),
    bulletItem("• Cách trả lời:", "Đối với từng ý a, b, c, d, nhấp vào nút **'Đúng'** hoặc **'Sai'** tương ứng."),
    calloutBox("THANG ĐIỂM CHẤM LŨY TIẾN CHUẨN BỘ GIÁO DỤC & ĐÀO TẠO", [
      "Thang điểm chấm câu hỏi Đúng/Sai được hệ thống tính tự động theo quy định mới:",
      "• Thí sinh chỉ trả lời ĐÚNG 1 Ý: Được tính 10% số điểm của câu hỏi.",
      "• Thí sinh trả lời ĐÚNG 2 Ý: Được tính 25% số điểm của câu hỏi.",
      "• Thí sinh trả lời ĐÚNG 3 Ý: Được tính 50% số điểm của câu hỏi.",
      "• Thí sinh trả lời ĐÚNG CẢ 4 Ý: Được tính 100% số điểm của câu hỏi.",
      "👉 Các em hãy cố gắng suy nghĩ cẩn thận từng ý để đạt trọn vẹn điểm số nhé!"
    ], "info"),

    h2("4.3 Phần III: Câu hỏi Tự Luận"),
    bulletItem("• Đặc điểm:", "Câu hỏi yêu cầu học sinh trình bày lời giải, diễn giải hoặc nhập câu trả lời tự luận trực tiếp."),
    bulletItem("• Cách trả lời:", "Học sinh nhấp chuột vào khung soạn thảo 'Nhập nội dung bài làm tự luận của em tại đây...' và gõ câu trả lời bằng bàn phím."),

    new Paragraph({ children: [new PageBreak()] })
  );

  // =========================================================================
  // PHẦN 5: CHỐNG NHÌN TRỘM BÀI LÀM TỰ LUẬN
  // =========================================================================
  sectionsChildren.push(
    h1("PHẦN 5: TÍNH NĂNG ĐỘC QUYỀN: CHỐNG NHÌN TRỘM TỰ LUẬN"),
    h2("5.1 Tại sao cần tính năng Chống nhìn trộm Tự luận (Anti-Peep Mode)?"),
    p("Khi làm bài kiểm tra trong phòng máy tính hoặc ngồi bàn học cạnh nhau, khoảng cách giữa các màn hình rất gần, học sinh ngồi bên cạnh có thể vô tình hoặc cố ý nhìn trộm bài làm tự luận của em."),
    p("Hệ thống EduTest Pro 2.0 đã tích hợp công nghệ **Chống nhìn trộm tự luận (Anti-Peep Mode)** độc quyền nhằm bảo vệ tối đa thành quả bài làm của từng học sinh!"),

    h2("5.2 Cơ chế hoạt động của Chế độ Chống nhìn trộm"),
    bulletItem("• Tự động gạch ngang chữ gõ:", "Ngay khi em gõ từng ký tự vào khung tự luận, toàn bộ chữ viết sẽ tự động có một đường gạch ngang ở giữa (strikethrough)."),
    bulletItem("• Thu nhỏ cỡ chữ tự động:", "Chữ viết được thu nhỏ lại vừa đủ (0.82rem) để người ngồi cách em một bước chân nhìn nghiêng sang sẽ hoàn toàn KHÔNG THỂ ĐỌC ĐƯỢC nội dung em đang làm bài!"),

    h2("5.3 Cách sử dụng Nút Con Mắt 👁️ để đọc lại bài làm"),
    p("Trong quá trình làm bài, khi em muốn đọc lại và rà soát kỹ lưỡng câu trả lời của mình:"),
    bulletItem("• Bước 1:", "Nhìn vào góc trên bên phải của khung câu hỏi tự luận, em sẽ thấy nút hình **Con mắt 👁️**."),
    bulletItem("• Bước 2:", "Nhấp chuột (hoặc chạm tay) vào nút **Con mắt 👁️**. Ngay lập tức, đường gạch ngang sẽ biến mất và chữ viết trở lại kích thước bình thường, rõ ràng để em đọc soát bài."),
    bulletItem("• Bước 3:", "Sau khi đọc xong, nhấp lại vào nút **Con mắt 👁️** một lần nữa. Nội dung sẽ lập tức được che lại bằng đường gạch ngang để tiếp tục bảo mật bài thi!"),

    calloutBox("LƯU Ý QUAN TRỌNG VỀ ĐIỂM SỐ TỰ LUẬN", [
      "Đường gạch ngang và thu nhỏ chữ CHỈ LÀ HIỆU ỨNG HIỂN THỊ TRÊN MÀN HÌNH để chống nhìn trộm.",
      "Khi nộp bài lên máy chủ, toàn bộ nội dung văn bản gốc đầy đủ, chuẩn xác, không bị gạch ngang sẽ được lưu về máy chủ của Thầy/Cô để Thầy/Cô chấm điểm chính xác 100%!"
    ], "success"),

    new Paragraph({ children: [new PageBreak()] })
  );

  // =========================================================================
  // PHẦN 6: QUY CHẾ GIÁM SÁT PHÒNG THI & CHỐNG GIAN LẬN
  // =========================================================================
  sectionsChildren.push(
    h1("PHẦN 6: QUY CHẾ GIÁM SÁT PHÒNG THI & CHỐNG GIAN LẬN (ANTI-CHEAT 2.0)"),
    p("Để đảm bảo môi trường thi minh bạch và công bằng tuyệt đối giữa các học sinh, EduTest Pro 2.0 trang bị hệ thống giám sát phòng thi tự động (Proctoring 2.0):"),

    h2("6.1 Bắt buộc chế độ Toàn màn hình (Fullscreen)"),
    bulletItem("•", "Đối với các bài kiểm tra chính thức, khi bấm vào làm bài, hệ thống sẽ yêu cầu chuyển sang chế độ Toàn màn hình (Fullscreen)."),
    bulletItem("•", "Mọi thanh công cụ và các ứng dụng khác trên máy tính/điện thoại sẽ được ẩn đi để học sinh tập trung 100% vào bài thi."),

    h2("6.2 Các hành vi bị tính là Vi phạm Quy chế phòng thi"),
    bulletItem("• Hành vi 1:", "Nhấn phím Esc để thoát khỏi chế độ toàn màn hình."),
    bulletItem("• Hành vi 2:", "Thu nhỏ cửa sổ trình duyệt xuống thanh tác vụ."),
    bulletItem("• Hành vi 3:", "Chuyển sang tab khác hoặc mở tab mới trên trình duyệt để tra cứu tài liệu Google."),
    bulletItem("• Hành vi 4:", "Mở các ứng dụng chat, Zalo, Messenger, phần mềm ghi chú trên máy tính."),

    h2("6.3 Cảnh báo vi phạm & Cơ chế Bịt kín lỗ hổng Nộp bài - Hủy"),
    bulletItem("• Cảnh báo đỏ tức thì:", "Khi học sinh vi phạm một trong các hành vi trên, hệ thống sẽ phát âm thanh báo động và hiện khung cảnh báo đỏ chiếm trọn màn hình, ghi nhận số lần vi phạm."),
    bulletItem("• Bịt kín lỗ hổng Nộp bài - Cancel:", "Kể cả khi học sinh bấm nút 'Nộp bài' hiện hộp thoại xác nhận rồi bấm 'Hủy / Cancel', màn hình vẫn DUY TRÌ GIÁM SÁT TOÀN MÀN HÌNH NGHIÊM NGẶT, không cho phép thu nhỏ để gian lận."),
    bulletItem("• TỰ ĐỘNG KHÓA VÀ NỘP BÀI CƯỠNG CHẾ:", "Nếu số lần vi phạm vượt quá mức cho phép của đề thi (Ví dụ: quá 5 lần), hệ thống sẽ TỰ ĐỘNG THU VÀ NỘP BÀI NGAY LẬP TỨC. Học sinh sẽ bị khóa bài và không được tiếp tục làm bài nữa!"),

    new Paragraph({ children: [new PageBreak()] })
  );

  // =========================================================================
  // PHẦN 7: RÀ SOÁT CÂU HỎI & NỘP BÀI THI
  // =========================================================================
  sectionsChildren.push(
    h1("PHẦN 7: RÀ SOÁT CÂU HỎI, NỘP BÀI THI & TRA CỨU KẾT QUẢ"),
    h2("7.1 Rà soát câu hỏi trước khi nộp bài"),
    bulletItem("•", "Trước khi nộp bài, học sinh nhìn sang Bảng câu hỏi bên phải xem còn câu nào màu xám (chưa làm) không."),
    bulletItem("•", "Bấm vào các ô màu xám để nhảy nhanh tới câu đó và hoàn thành câu trả lời."),

    h2("7.2 Quy trình nộp bài thi lên máy chủ"),
    bulletItem("• Bước 1:", "Bấm nút màu xanh **'Nộp Bài'** ở góc trên bên phải màn hình."),
    bulletItem("• Bước 2:", "Hộp thoại xác nhận sẽ hiện ra, thông báo rõ em đã làm được bao nhiêu câu trên tổng số câu hỏi."),
    bulletItem("• Bước 3:", "Nếu chắc chắn muốn nộp, bấm **'Đồng ý Nộp Bài'**. Hệ thống sẽ mã hóa và gửi bài làm về máy chủ Google Sheets của Thầy/Cô."),

    h2("7.3 Màn hình Vinh danh & Tra cứu kết quả"),
    bulletItem("• Biểu tượng Cúp vàng 🏆:", "Hiển thị lời chúc mừng em đã hoàn thành bài thi."),
    bulletItem("• Điểm số đạt được:", "Hiển thị điểm số trắc nghiệm (trên thang điểm 10.0), số câu làm đúng và tổng thời gian làm bài."),
    bulletItem("• Đối với bài thi có câu hỏi Tự luận:", "Hệ thống sẽ ghi chú 'Chờ giáo viên chấm tự luận'. Sau khi Thầy/Cô chấm xong, điểm tổng hợp sẽ được cập nhật đầy đủ."),
    bulletItem("• Xem lại bài thi (Đối với chế độ Ôn tập):", "Cuộn xuống dưới màn hình để xem lại chi tiết từng câu hỏi, đáp án em đã chọn và đáp án đúng màu xanh lá cây để rút kinh nghiệm học tập."),

    new Paragraph({ children: [new PageBreak()] })
  );

  // =========================================================================
  // PHẦN 8: TIỆN ÍCH NHẠC NỀN & QUẢN LÝ TÀI KHOẢN
  // =========================================================================
  sectionsChildren.push(
    h1("PHẦN 8: WIDGET NHẠC NỀN THƯ GIÃN & QUẢN LÝ TÀI KHOẢN"),
    h2("8.1 Widget Nhạc Nền Thư Giãn Phòng Thi"),
    p("Âm nhạc du dương không lời giúp não bộ giảm căng thẳng phòng thi, tăng cường sự tập trung khi tư duy giải quyết câu hỏi:"),
    bulletItem("• Nút Cái Loa nhỏ:", "Nằm ở góc trên bên phải màn hình, có chấm đèn xanh phát sóng khi đang phát nhạc."),
    bulletItem("• 3 bản nhạc bất hủ được chọn ngẫu nhiên khi vào phòng thi:"),
    bulletItem("   1) Woman in Love (Barbra Streisand):", "Tự động phát ở mức âm lượng 50% du dương."),
    bulletItem("   2) Love Story (Taylor Swift):", "Tự động phát ở mức âm lượng 30% êm dịu."),
    bulletItem("   3) Sealed With a Kiss (Brian Hyland):", "Tự động phát ở mức âm lượng 30% êm dịu."),
    bulletItem("• Bảng điều khiển Popup:", "Học sinh bấm vào nút Cái Loa để mở bảng điều khiển: Bật/Tắt nhạc (Play/Pause), Chuyển bài nhanh (⏭️), Tắt tiếng (Mute), Kéo thanh âm lượng hoặc chọn các nấc nhanh: 15% (Nhẹ), 30% (Chuẩn), 50% (Vừa), 80% (To)."),

    h2("8.2 Hướng dẫn Tự Đổi Mật Khẩu Cá Nhân"),
    bulletItem("• Bước 1:", "Tại Bảng điều khiển học sinh, bấm vào khung tên của mình ở góc trên bên phải > Chọn **'Đổi mật khẩu'**."),
    bulletItem("• Bước 2:", "Nhập Mật khẩu hiện tại, sau đó nhập Mật khẩu mới và Nhập lại mật khẩu mới để xác nhận."),
    bulletItem("• Bước 3:", "Bấm **'Lưu Mật Khẩu Mới'**. Mật khẩu mới sẽ được cập nhật trực tiếp vào cơ sở dữ liệu."),

    new Paragraph({ children: [new PageBreak()] })
  );

  // =========================================================================
  // PHẦN 9: XỬ LÝ SỰ CỐ PHÒNG THI THƯỜNG GẶP
  // =========================================================================
  sectionsChildren.push(
    h1("PHẦN 9: BẢNG TỔNG HỢP SỰ CỐ THƯỜNG GẶP & CÁCH XỬ LÝ NHANH"),
    p("Dưới đây là các tình huống thường gặp và cách xử lý nhanh chóng để học sinh yên tâm làm bài:"),

    createTable(
      ["Tình huống sự cố", "Nguyên nhân chính", "Cách khắc phục ngay lập tức"],
      [
        ["Báo lỗi không đăng nhập được", "Chưa chọn đúng Thầy/Cô hoặc sai mã HS / mật khẩu", "Bấm chọn lại đúng tên Thầy/Cô dạy lớp mình. Kiểm tra lại chữ hoa/thường mã HS và mật khẩu."],
        ["Đang làm bài bị mất điện hoặc rớt mạng", "Sự cố đường truyền Internet hoặc thiết bị", "Yên tâm: Bài làm đã được tự động lưu liên tục trên máy. Khi có mạng/điện lại, chỉ cần mở lại trang web là tiếp tục làm bài bình thường!"],
        ["Bị khóa toàn màn hình hoặc hiện cảnh báo đỏ", "Bấm nhầm phím Esc, thu nhỏ tab hoặc mở ứng dụng khác", "Bấm nút 'Quay lại làm bài' và giữ nguyên màn hình tối đa. Không chuyển tab để tránh bị tự động nộp bài cưỡng chế."],
        ["Chữ trong ô tự luận bị gạch ngang", "Tính năng Chống nhìn trộm đang hoạt động", "Đây là tính năng bảo vệ bài thi bình thường. Bấm nút hình Con mắt 👁️ ở góc câu để tạm xem chữ bình thường khi cần đọc lại bài."],
        ["Không nhìn thấy đề kiểm tra của lớp", "Thầy/Cô chưa mở đề thi hoặc em vào nhầm giáo viên", "Báo Thầy/Cô kiểm tra xem đề đã được gạt sang trạng thái MỞ chưa, và kiểm tra lại xem em đã chọn đúng Thầy/Cô chưa."]
      ],
      [24, 30, 46]
    ),

    new Paragraph({ spacing: { before: 180, after: 80 } }),
    calloutBox("LỜI CHÚC DÀNH CHO CÁC EM HỌC SINH", [
      "Thầy chúc tất cả các em học sinh luôn bình tĩnh, tự tin, đọc kỹ đề bài và hoàn thành bài kiểm tra với kết quả cao nhất!",
      "Nếu gặp bất kỳ khó khăn kỹ thuật nào, hãy liên hệ ngay với Thầy/Cô giám thị hoặc Thầy Nguyễn Phi Hùng (0938.750.424) để được hỗ trợ kịp thời!"
    ], "success")
  );

  // Cấu hình Document
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
            top: 1440,
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
                  text: "EduTest Pro 2.0 - Hướng dẫn Học sinh Tham gia Thi trực tuyến (Bản mới 2026)",
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
                  text: "Hệ thống EduTest Pro 2.0  |  Thầy Nguyễn Phi Hùng (0938.750.424)  |  Trang ",
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

  console.log("Dang dong goi file docx hoc sinh...");
  const buffer = await Packer.toBuffer(doc);
  const outputPath = path.join(__dirname, "Huong_Dan_Hoc_Sinh_EduTest_Pro_2.0.docx");
  fs.writeFileSync(outputPath, buffer);
  console.log("XUAT THANH CONG! File hoc sinh duoc luu tai:", outputPath);
  console.log("Kich thuoc file:", (buffer.length / 1024).toFixed(2), "KB");
}

generateStudentDocx().catch(err => {
  console.error("LOI KHI TAO FILE DOCX HOC SINH:", err);
  process.exit(1);
});
