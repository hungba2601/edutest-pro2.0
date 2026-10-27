/**
 * Script tạo file Huong_Dan_Hoc_Sinh_EduTest_Pro_2.0.docx
 * Hướng dẫn chi tiết cách học sinh đăng nhập và sử dụng hệ thống
 * Tài khoản mẫu: demohs | Mật khẩu: 1234
 * Chọn giáo viên: Nguyễn Phi Hùng - Thầy 5C
 * Kèm đầy đủ hình ảnh chụp thực tế từng bước
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

// Bảng màu sắc thiết kế chuẩn văn phòng tài liệu chuyên nghiệp
const COLOR = {
  PRIMARY: "1E3A8A",      // Xanh Navy đậm (Tiêu đề chính)
  SECONDARY: "2563EB",    // Xanh Royal Blue (Tiêu đề phụ, nhấn mạnh)
  ACCENT_GREEN: "059669", // Xanh ngọc lục bảo (Thành công, đúng)
  ACCENT_AMBER: "D97706", // Vàng hổ phách (Lưu ý, cảnh báo)
  ACCENT_RED: "DC2626",   // Đỏ ruby (Cảnh báo nguy hiểm, vi phạm)
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

// Helper tạo Paragraph văn bản thông thường
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

// Helper tạo danh sách đầu dòng (Bullet Item)
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

// Helper Heading 1, 2, 3
function h1(title) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 120 },
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
        size: 26, // 13pt
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
              left: { style: BorderStyle.SINGLE, size: 26, color: borderColor },
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

// Helper chèn hình ảnh minh họa thực tế vào tài liệu Word
function imageFigure(imageFileName, captionText, width = 560, height = 360) {
  const imgPath = path.join(__dirname, "student_guide_images", imageFileName);
  if (!fs.existsSync(imgPath)) {
    console.warn("Image file not found:", imgPath);
    return [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 100, after: 100 },
        children: [
          new TextRun({ text: `[Hình ảnh: ${imageFileName} (Đang cập nhật)]`, font: "Arial", italics: true, color: "DC2626" })
        ]
      })
    ];
  }

  const imgBuffer = fs.readFileSync(imgPath);

  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 140, after: 50 },
      children: [
        new ImageRun({
          data: imgBuffer,
          transformation: {
            width: width,
            height: height
          }
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 40, after: 160 },
      children: [
        new TextRun({
          text: captionText,
          font: "Arial",
          size: 19, // 9.5pt
          bold: true,
          italics: true,
          color: "475569"
        })
      ]
    })
  ];
}

// Helper tạo Bảng (Table)
function createTable(headers, rowsData, colWidths = []) {
  const tableRows = [];

  // Dòng Tiêu đề (Header)
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

  // Các dòng dữ liệu (Data rows)
  rowsData.forEach((row, rowIndex) => {
    const isEven = rowIndex % 2 === 0;
    const bg = isEven ? COLOR.WHITE : COLOR.LIGHT_BG;

    const dataCells = row.map((cellText, colIndex) => {
      let isFirstCol = colIndex === 0;
      let align = isFirstCol && cellText.length < 5 ? AlignmentType.CENTER : AlignmentType.LEFT;

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
                bold: isFirstCol && cellText.length > 3 && colIndex === 0
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

// ============================================================================
// HÀM CHÍNH TẠO TOÀN BỘ TÀI LIỆU HƯỚNG DẪN HỌC SINH
// ============================================================================
async function buildStudentGuideDocx() {
  console.log("Đang tổng hợp nội dung và tạo tài liệu Word...");

  const docChildren = [];

  // =========================================================================
  // TRANG BÌA (COVER PAGE)
  // =========================================================================
  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 80 },
      children: [
        new TextRun({
          text: "HỆ THỐNG THI & KIỂM TRA TRỰC TUYẾN THÔNG MINH EDUTEST PRO 2.0",
          font: "Arial",
          size: 20,
          bold: true,
          color: COLOR.SECONDARY
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 200 },
      children: [
        new TextRun({
          text: "HƯỚNG DẪN CHI TIẾT",
          font: "Arial",
          size: 44, // 22pt
          bold: true,
          color: COLOR.PRIMARY
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 400 },
      children: [
        new TextRun({
          text: "DÀNH CHO HỌC SINH THAM GIA THI TRỰC TUYẾN",
          font: "Arial",
          size: 32, // 16pt
          bold: true,
          color: COLOR.ACCENT_GREEN
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 300 },
      children: [
        new TextRun({
          text: "Đăng Nhập Máy Chủ Lớp • Làm Bài Trắc Nghiệm 4 Lựa Chọn & Đúng/Sai • Giám Sát Chống Gian Lận • Nộp Bài & Tra Cứu Kết Quả",
          font: "Arial",
          size: 22,
          italics: true,
          color: COLOR.MUTED_TEXT
        })
      ]
    }),

    // Bảng thông tin tài khoản mẫu
    createTable(
      ["Mục Thông Tin", "Chi Tiết Cấu Hình Phòng Thi"],
      [
        ["Tài khoản Học sinh mẫu", "demohs"],
        ["Mật khẩu đăng nhập", "1234"],
        ["Thầy / Cô phụ trách phòng thi", "Nguyễn Phi Hùng - Thầy 5C (THCS An Nhơn - Trụ sở chính)"],
        ["Lớp học áp dụng mẫu", "Lớp 9A1 (Họ tên: HS DEMO)"],
        ["Đường link truy cập hệ thống", "Mở liên kết web phòng thi do Thầy/Cô cung cấp"],
        ["Thiết bị hỗ trợ", "Máy tính để bàn (PC), Laptop, Máy tính bảng, Điện thoại di động"],
        ["Năm học thực hiện", "Năm học 2026 - 2027"]
      ],
      [35, 65]
    ),

    p("", { spacingBefore: 400 }),

    calloutBox(
      "THÔNG ĐIỆP DÀNH CHO THÍ SINH",
      [
        "Hệ thống EduTest Pro 2.0 được xây dựng nhằm tạo ra môi trường kiểm tra hiện đại, công bằng, trực quan và tiện lợi nhất cho các em học sinh.",
        "Để bài thi được chấm chính xác và lưu an toàn về máy chủ lớp học, các em cần đọc kỹ từng bước hướng dẫn trong tài liệu này trước khi bước vào phòng thi."
      ],
      "success"
    ),

    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 600, after: 100 },
      children: [
        new TextRun({
          text: "Tác giả phát triển & Quản trị hệ thống: Thầy NGUYỄN PHI HÙNG\nHotline / Zalo hỗ trợ kỹ thuật: 0938.750.424",
          font: "Arial",
          size: 20,
          bold: true,
          color: COLOR.PRIMARY
        })
      ]
    }),

    new Paragraph({ children: [new PageBreak()] })
  );

  // =========================================================================
  // MỤC LỤC & TỔNG QUAN HỆ THỐNG
  // =========================================================================
  docChildren.push(
    h1("MỤC LỤC TÀI LIỆU HƯỚNG DẪN"),
    bulletItem("Phần 1:", "Hướng Dẫn Đăng Nhập Hệ Thống Đúng Quy Chuẩn"),
    bulletItem("Phần 2:", "Giao Diện Bảng Điều Khiển Học Sinh (Student Dashboard)"),
    bulletItem("Phần 3:", "Quy Trình Vào Phòng Thi & Thao Tác Làm Bài"),
    bulletItem("Phần 4:", "Cách Làm Câu Hỏi Trắc Nghiệm Nhiều Lựa Chọn & Đúng/Sai"),
    bulletItem("Phần 5:", "Quy Chế Giám Sát Phòng Thi & Chống Gian Lận (Proctoring)"),
    bulletItem("Phần 6:", "Rà Soát Câu Hỏi Chưa Làm & Nộp Bài Thi Lên Máy Chủ"),
    bulletItem("Phần 7:", "Xem Điểm Số, Kết Quả & Tra Cứu Lời Giải Chi Tiết"),
    bulletItem("Phần 8:", "Hướng Dẫn Đổi Mật Khẩu Cá Nhân & Quản Lý Tài Khoản"),
    bulletItem("Phần 9:", "Bảng Tổng Hợp Sự Cố Thường Gặp & Cách Khắc Phục Nhanh"),

    p("", { spacingBefore: 150 }),

    h1("TỔNG QUAN VỀ HỆ THỐNG THI EDUTEST PRO 2.0"),
    p("EduTest Pro 2.0 là nền tảng thi và kiểm tra trực tuyến thế hệ mới, vận hành trên nền tảng đám mây Google Workspace, giúp học sinh làm bài thi trắc nghiệm mọi lúc mọi nơi trên mọi thiết bị."),
    p("Những tính năng nổi bật dành riêng cho học sinh bao gồm:"),
    bulletItem("• Phân luồng phòng thi thông minh:", "Học sinh chọn đúng Thầy/Cô giảng dạy lớp mình để nộp bài chuẩn xác về đúng sổ điểm của giáo viên."),
    bulletItem("• Đầy đủ các dạng đề thi theo chuẩn Bộ GD&ĐT:", "Bao gồm Phần I (Trắc nghiệm 4 lựa chọn A, B, C, D) và Phần II (Trắc nghiệm Đúng / Sai từng ý a, b, c, d)."),
    bulletItem("• Bảng điều hướng câu hỏi (Question Palette):", "Học sinh biết chính xác câu nào đã làm, câu nào chưa làm và nhấp vào số câu để chuyển nhanh."),
    bulletItem("• Đồng hồ đếm ngược thông minh:", "Hiển thị thời gian còn lại trực quan, có âm thanh và thông báo nhắc nhở khi còn dưới 5 phút và 1 phút cuối cùng."),
    bulletItem("• Cơ chế chống gian lận (Proctoring):", "Bảo đảm tính công bằng tuyệt đối giữa các học sinh thông qua chế độ toàn màn hình và ghi nhận số lần vi phạm rời tab."),
    bulletItem("• Chế độ ôn tập linh hoạt:", "Với các bài ôn tập, học sinh được làm nhiều lần, xem lại bài làm kèm giải thích chi tiết từng câu để rút kinh nghiệm học tập."),

    new Paragraph({ children: [new PageBreak()] })
  );

  // =========================================================================
  // PHẦN 1: HƯỚNG DẪN ĐĂNG NHẬP HỆ THỐNG
  // =========================================================================
  docChildren.push(
    h1("PHẦN 1: HƯỚNG DẪN ĐĂNG NHẬP HỆ THỐNG ĐÚNG QUY CHUẨN"),
    p("Để đảm bảo quyền lợi và bài thi nộp về đúng lớp học, học sinh cần thực hiện nghiêm túc 3 bước đăng nhập tuần tự dưới đây:"),

    h2("1.1. Bước 1: Mở trình duyệt & Truy cập trang đăng nhập"),
    p("Học sinh mở trình duyệt web (khuyến nghị dùng Google Chrome, Microsoft Edge, Cốc Cốc hoặc Safari trên điện thoại/máy tính) và truy cập vào đường link website của nhà trường."),
    bulletItem("• Kiểm tra vai trò đăng nhập:", "Hệ thống mặc định chọn sẵn vai trò 'Học sinh' (tab màu xanh bên trái). Nếu đang ở vai trò khác, các em chỉ cần nhấp chuột vào nút 'Học sinh'."),

    ...imageFigure(
      "01_trang_dang_nhap.png",
      "Hình 1: Màn hình Đăng nhập hệ thống EduTest Pro 2.0 với vai trò 'Học sinh' được chọn mặc định",
      560,
      350
    ),

    h2("1.2. Bước 2 (CỰC KỲ QUAN TRỌNG): Chọn đúng Thầy/Cô phụ trách phòng thi"),
    calloutBox(
      "CẢNH BÁO BẮT BUỘC TỪ HỆ THỐNG PHÒNG THI",
      [
        "Học sinh BẮT BUỘC phải nhấp vào ô 'THẦY / CÔ PHỤ TRÁCH PHÒNG THI (*)' và chọn đúng tên Giáo viên đang giảng dạy lớp của mình.",
        "Ví dụ đối với lớp bạn: Nhấp chọn dòng '👨‍🏫 Nguyễn Phi Hùng - Thầy 5C (THCS An Nhơn - Trụ sở chính)'.",
        "❌ NẾU KHÔNG CHỌN HOẶC CHỌN SAI: Hệ thống sẽ chặn đăng nhập hoặc nếu nộp nhầm máy chủ giáo viên khác, bài thi của bạn sẽ không có trong sổ điểm của lớp dẫn tới BỊ 0 ĐIỂM!"
      ],
      "danger"
    ),

    p("Sau khi chọn xong Thầy Nguyễn Phi Hùng, giao diện sẽ xuất hiện hộp màu xanh lá cây xác nhận:"),
    p("✅ 'Đang kết nối phòng thi: Nguyễn Phi Hùng - Thầy 5C (THCS An Nhơn - Trụ sở chính)' như hình minh họa bên dưới."),

    ...imageFigure(
      "02_chon_giao_vien.png",
      "Hình 2: Chọn Thầy Nguyễn Phi Hùng - Thầy 5C và thông báo xác nhận kết nối máy chủ thành công",
      560,
      350
    ),

    h2("1.3. Bước 3: Nhập thông tin tài khoản và mật khẩu học sinh"),
    p("Sau khi đã chọn đúng giáo viên, học sinh điền thông tin đăng nhập của mình:"),
    createTable(
      ["Trường Thông Tin", "Giá Trị Mẫu Minh Họa", "Ghi Chú Hướng Dẫn"],
      [
        ["Tài khoản học sinh", "demohs", "Nhập mã học sinh do Thầy/Cô cấp (không phân biệt chữ hoa/thường)"],
        ["Mật khẩu", "1234", "Nhập đúng mật khẩu được cấp (bấm biểu tượng con mắt để xem rõ)"],
        ["Hành động", "Bấm nút 'Đăng Nhập'", "Hệ thống sẽ xác thực trực tiếp với cơ sở dữ liệu Google Sheets"]
      ],
      [30, 25, 45]
    ),

    p("Sau khi điền đủ tài khoản và mật khẩu, học sinh bấm nút **'Đăng Nhập'** màu xanh lam bên dưới. Hệ thống sẽ kiểm tra bảo mật trong 1-2 giây và tự động chuyển hướng các em vào Bảng điều khiển thi."),

    ...imageFigure(
      "03_nhap_tai_khoan_mat_khau.png",
      "Hình 3: Nhập tài khoản 'demohs' và mật khẩu '1234' trước khi bấm Đăng Nhập",
      560,
      350
    ),

    new Paragraph({ children: [new PageBreak()] })
  );

  // =========================================================================
  // PHẦN 2: BẢNG ĐIỀU KHIỂN HỌC SINH (STUDENT DASHBOARD)
  // =========================================================================
  docChildren.push(
    h1("PHẦN 2: GIAO DIỆN BẢNG ĐIỀU KHIỂN HỌC SINH (STUDENT DASHBOARD)"),
    p("Sau khi đăng nhập thành công, học sinh sẽ nhìn thấy màn hình Bảng điều khiển cá nhân với đầy đủ thông tin định danh và danh sách các đề thi được mở cho lớp của mình."),

    h2("2.1. Thẻ thông tin cá nhân của học sinh"),
    p("Tại đầu trang, thẻ thông tin cá nhân hiển thị rõ ràng:"),
    bulletItem("• Lời chào thí sinh:", "Xin chào HS DEMO!"),
    bulletItem("• Mã học sinh:", "DEMOHS"),
    bulletItem("• Lớp học:", "9A1"),
    bulletItem("• Ngày sinh:", "26/01/1984"),
    bulletItem("• Giới tính:", "Nam"),
    bulletItem("• Trường học:", "THCS AN NHƠN (Trụ sở chính)"),
    p("👉 *Học sinh lưu ý kiểm tra lại xem thông tin hiển thị trên màn hình có đúng là của mình không. Nếu phát hiện sai sót, hãy báo ngay cho Thầy/Cô để được cập nhật.*"),

    h2("2.2. Danh sách các kỳ thi đang mở cho lớp"),
    p("Hệ thống EduTest Pro 2.0 phân biệt 2 loại bài thi rõ ràng:"),
    bulletItem("1. Chế độ Ôn tập / Luyện tập (📖 Màu xanh lá):", "Cho phép học sinh làm bài nhiều lần để rèn luyện kỹ năng. Điểm số hệ thống sẽ lưu kết quả của lần nộp bài cuối cùng. Sau khi nộp, học sinh được xem lại bài làm và lời giải chi tiết."),
    bulletItem("2. Chế độ Thi / Kiểm tra chính thức (🔒 Màu vàng/đỏ):", "Chỉ cho phép học sinh làm bài 1 LẦN DUY NHẤT. Khi đã nộp bài, đề thi sẽ tự động khóa chuyển sang trạng thái 'Đã Nộp Bài (Chỉ thi 1 lần)' và không thể làm lại."),

    ...imageFigure(
      "04_bang_dieu_khien_hoc_sinh.png",
      "Hình 4: Bảng điều khiển Học sinh hiển thị thông tin thí sinh và danh sách các đề kiểm tra đang mở",
      560,
      350
    ),

    h2("2.3. Menu tài khoản cá nhân & Chức năng Đổi mật khẩu"),
    p("Ở góc trên cùng bên phải thanh điều hướng, học sinh nhấp chuột vào khung tên của mình sẽ mở ra menu thả xuống tiện ích:"),
    bulletItem("• Thông tin cá nhân:", "Xem chi tiết hồ sơ thí sinh, trường lớp, ngày sinh."),
    bulletItem("• Đổi mật khẩu:", "Học sinh tự đặt mật khẩu riêng cho mình để tránh trường hợp bạn khác vào nhầm tài khoản."),
    bulletItem("• Đăng xuất:", "Thoát tài khoản an toàn khi sử dụng chung máy tính ở phòng máy hoặc máy tính mượn."),

    ...imageFigure(
      "05_menu_tai_khoan_hoc_sinh.png",
      "Hình 5: Menu tùy chọn tài khoản cá nhân, đổi mật khẩu và đăng xuất hệ thống",
      560,
      350
    ),

    new Paragraph({ children: [new PageBreak()] })
  );

  // =========================================================================
  // PHẦN 3 & 4: GIAO DIỆN PHÒNG THI & THAO TÁC LÀM BÀI
  // =========================================================================
  docChildren.push(
    h1("PHẦN 3: GIAO DIỆN PHÒNG THI TRỰC TUYẾN & THAO TÁC LÀM BÀI"),
    p("Để bắt đầu làm bài, học sinh nhấp vào nút **'Bắt Đầu Làm Bài'** (hoặc 'Tiếp Tục Ôn Luyện') trên thẻ bài thi tương ứng."),

    h2("3.1. Tổng quan bố cục phòng thi trực tuyến"),
    p("Phòng thi trực tuyến của EduTest Pro 2.0 được thiết kế khoa học theo tiêu chuẩn khảo thí quốc tế với 3 khu vực chính:"),
    bulletItem("1. Thanh Header dính trên cùng (Sticky Header):", "Hiển thị tên kỳ thi, mã đề, trạng thái phòng thi, Đồng hồ đếm ngược thời gian và nút 'Nộp Bài'."),
    bulletItem("2. Cột bên trái (Khung đề thi):", "Khu vực hiển thị nội dung các câu hỏi, hình ảnh đề bài (nếu có) và các phương án trả lời."),
    bulletItem("3. Cột bên phải (Bảng câu hỏi - Question Palette):", "Hiển thị danh sách toàn bộ số câu hỏi trong đề thi. Bấm vào bất kỳ số câu nào, màn hình sẽ tự động cuộn nhanh tới câu đó."),

    ...imageFigure(
      "06_giao_dien_phong_thi.png",
      "Hình 6: Toàn cảnh giao diện Phòng thi trực tuyến với Đồng hồ đếm ngược và Bảng câu hỏi bên phải",
      560,
      350
    ),

    h2("3.2. Cách làm câu hỏi Trắc nghiệm nhiều lựa chọn (Phần I)"),
    p("Trong Phần I, mỗi câu hỏi có 4 phương án lựa chọn A, B, C, D:"),
    bulletItem("• Thao tác chọn:", "Học sinh chỉ cần nhấp chuột hoặc chạm tay vào phương án mình cho là đúng nhất."),
    bulletItem("• Nhận diện trực quan:", "Phương án được chọn sẽ sáng lên với viền xanh lam nổi bật và nút radio được tích chọn."),
    bulletItem("• Cập nhật bảng câu hỏi:", "Ngay khi chọn xong, ô số thứ tự tương ứng trên Bảng câu hỏi bên phải sẽ lập tức đổi sang màu xanh dương đậm (Đã làm)."),
    bulletItem("• Đổi đáp án:", "Nếu muốn thay đổi câu trả lời, các em chỉ cần nhấp vào phương án khác bất kỳ lúc nào trước khi nộp bài."),

    ...imageFigure(
      "07_thao_tac_chon_dap_an.png",
      "Hình 7: Thao tác chọn đáp án trắc nghiệm, các ô câu đã làm trên Bảng câu hỏi tự động đổi màu",
      560,
      350
    ),

    h2("3.3. Cách làm câu hỏi Trắc nghiệm Đúng / Sai (Phần II)"),
    p("Phần II được thiết kế theo cấu trúc đề thi mới nhất của Bộ Giáo dục & Đào tạo. Mỗi câu hỏi gồm 4 nhận định độc lập a), b), c), d):"),
    bulletItem("• Yêu cầu bắt buộc:", "Học sinh phải xác định tính Đúng hoặc Sai cho TỪNG Ý trong số 4 ý."),
    bulletItem("• Cách chọn:", "Nhấp vào cột 'ĐÚNG' hoặc cột 'SAI' tương ứng với nhận định a, b, c, d."),
    bulletItem("• Lưu ý quan trọng:", "Chỉ khi học sinh hoàn thành ĐỦ CẢ 4 Ý (a, b, c, d) thì câu hỏi đó mới được tính là 'Đã hoàn thành' trên Bảng câu hỏi. Nếu thiếu dù chỉ 1 ý, hệ thống vẫn đánh dấu câu đó chưa xong!"),

    ...imageFigure(
      "08_cau_hoi_dung_sai.png",
      "Hình 8: Giao diện làm bài câu hỏi Trắc nghiệm Đúng / Sai theo định dạng chuẩn khảo thí mới",
      560,
      350
    ),

    new Paragraph({ children: [new PageBreak()] })
  );

  // =========================================================================
  // PHẦN 5: QUY CHẾ GIÁM SÁT PHÒNG THI & CHỐNG GIAN LẬN
  // =========================================================================
  docChildren.push(
    h1("PHẦN 4: QUY CHẾ GIÁM SÁT PHÒNG THI & CHỐNG GIAN LẬN (PROCTORING)"),
    p("Đối với các kỳ kiểm tra chính thức (15 phút, 1 tiết, giữa kỳ, học kỳ), hệ thống EduTest Pro 2.0 kích hoạt cơ chế giám sát thi trực tuyến tự động nhằm bảo vệ tính công bằng, nghiêm túc và minh bạch tuyệt đối."),

    h2("4.1. Chế độ Toàn màn hình (Full Screen) bắt buộc"),
    p("Khi bắt đầu bài thi chính thức, trình duyệt sẽ tự động phóng to toàn màn hình. Học sinh cần tập trung làm bài thi trong suốt thời gian quy định."),

    h2("4.2. Các hành vi bị hệ thống tính là vi phạm quy chế"),
    bulletItem("1. Thoát chế độ toàn màn hình:", "Bấm phím ESC, F11 hoặc nút thu nhỏ cửa sổ trình duyệt."),
    bulletItem("2. Mở tab mới hoặc chuyển cửa sổ:", "Chuyển sang tab khác để tra Google, Facebook, Zalo hoặc mở ứng dụng khác trên máy."),
    bulletItem("3. Chuyển ứng dụng trên điện thoại:", "Vuốt màn hình thoát ra ngoài hoặc nhận cuộc gọi khi đang làm bài."),

    h2("4.3. Cơ chế cảnh báo và chế tài xử lý tự động"),
    calloutBox(
      "CƠ CHẾ PHẠT TỰ ĐỘNG THU BÀI KHI VI PHẠM QUÁ SỐ LẦN CHO PHÉP",
      [
        "Hệ thống cho phép cảnh báo tối đa 5 lần vi phạm.",
        "Mỗi lần vi phạm, màn hình sẽ hiển thị hộp thoại màu đỏ cảnh báo số lần vi phạm (Ví dụ: 1/5 lần, 2/5 lần,...).",
        "🚨 ĐẶC BIỆT LƯU Ý: Nếu học sinh tiếp tục vi phạm đến lần thứ 6, hệ thống sẽ TỰ ĐỘNG KHÓA VÀ NỘP BÀI THI NGAY LẬP TỨC với số câu hiện tại! Học sinh không thể làm tiếp và phải chịu kết quả đã nộp."
      ],
      "danger"
    ),

    ...imageFigure(
      "09_canh_bao_vi_pham_gian_lan.png",
      "Hình 9: Hộp thoại cảnh báo vi phạm quy chế phòng thi khi học sinh rời khỏi màn hình làm bài",
      560,
      350
    ),

    new Paragraph({ children: [new PageBreak()] })
  );

  // =========================================================================
  // PHẦN 6: RÀ SOÁT CÂU HỎI & NỘP BÀI THI
  // =========================================================================
  docChildren.push(
    h1("PHẦN 5: RÀ SOÁT CÂU HỎI CHƯA LÀM & NỘP BÀI THI"),
    p("Trước khi nộp bài, học sinh cần kiểm tra cẩn thận để đạt được điểm số cao nhất có thể."),

    h2("5.1. Rà soát bài thi qua Bảng câu hỏi"),
    p("Nhìn vào Bảng câu hỏi ở cột bên phải:"),
    bulletItem("• Các ô màu xanh đậm:", "Đã hoàn thành câu trả lời."),
    bulletItem("• Các ô màu xám trắng:", "Câu hỏi chưa làm hoặc chưa chọn đáp án."),
    p("👉 Hãy nhấp vào các ô màu xám để nhảy ngay đến câu đó và hoàn thành trước khi nộp!"),

    h2("5.2. Tính năng bảo vệ thông minh: Chặn nộp bài khi chưa làm hết"),
    p("Để tránh trường hợp học sinh vô tình bấm nhầm nút nộp bài khi còn nhiều câu chưa làm, EduTest Pro 2.0 trang bị tính năng cảnh báo câu chưa làm:"),
    bulletItem("• Khi bấm nút 'Nộp Bài':", "Nếu còn bất kỳ câu hỏi nào chưa chọn đáp án (kể cả câu Đúng/Sai chưa đủ 4 ý), hệ thống sẽ bật modal màu đỏ 'CHƯA THỂ NỘP BÀI THI!'."),
    bulletItem("• Liệt kê cụ thể:", "Hệ thống chỉ rõ chính xác Câu mấy chưa làm để học sinh biết và hoàn thiện."),
    bulletItem("• Nút 'Quay Lại Làm Bài':", "Nhấp vào để tiếp tục hoàn thành các câu còn thiếu."),

    ...imageFigure(
      "10_canh_bao_chua_hoan_thanh.png",
      "Hình 10: Modal cảnh báo bắt buộc hoàn thành tất cả các câu hỏi trước khi được phép nộp bài",
      560,
      350
    ),

    h2("5.3. Xác nhận nộp bài lên máy chủ"),
    p("Khi đã hoàn thành 100% các câu hỏi, học sinh bấm nút **'Nộp Bài'**, xác nhận đồng ý nộp. Bài làm sẽ được mã hóa và gửi tức thời lên máy chủ Google Sheets của Thầy Nguyễn Phi Hùng."),

    new Paragraph({ children: [new PageBreak()] })
  );

  // =========================================================================
  // PHẦN 7: XEM KẾT QUẢ & LỜI GIẢI CHI TIẾT
  // =========================================================================
  docChildren.push(
    h1("PHẦN 6: TRA CỨU ĐIỂM SỐ & XEM LẠI ĐÁP ÁN CHI TIẾT"),
    p("Ngay sau khi nộp bài thành công, học sinh sẽ nhận được kết quả tức thì."),

    h2("6.1. Màn hình chúc mừng và công bố điểm thi"),
    p("Màn hình kết quả hiển thị sinh động và chi tiết:"),
    bulletItem("• Biểu tượng Cúp vàng vinh danh:", "Ghi nhận nỗ lực hoàn thành bài thi của thí sinh."),
    bulletItem("• Điểm số phần trắc nghiệm:", "Hiển thị điểm đạt được trên thang điểm 10 (Ví dụ: 9.5 / 10 điểm)."),
    bulletItem("• Số câu đúng:", "Thống kê chính xác số câu làm đúng (Ví dụ: 23 / 24 câu)."),
    bulletItem("• Thời gian làm bài:", "Hiển thị tổng thời gian từ lúc bắt đầu đến khi nộp bài (Ví dụ: 28 phút 15 giây)."),

    ...imageFigure(
      "11_man_hinh_ket_qua_thi.png",
      "Hình 11: Màn hình kết quả thi hiển thị Cúp chúc mừng, điểm số trắc nghiệm và số câu đúng",
      560,
      350
    ),

    h2("6.2. Xem lại bài làm và lời giải chi tiết (Chế độ Ôn tập)"),
    p("Đối với các đề ôn tập, học sinh nhấp vào nút **'Xem Lại Bài Làm & Đáp Án'** màu xanh ngọc để mở cửa sổ tra cứu chi tiết:"),
    bulletItem("• Đáp án học sinh đã chọn:", "Được hiển thị rõ ràng để học sinh đối chiếu."),
    bulletItem("• Đáp án chuẩn của giáo viên:", "Tô màu xanh lá cây nổi bật kèm ký hiệu ✓."),
    bulletItem("• Khung giải thích chi tiết (💡):", "Cung cấp kiến thức trọng tâm, lý do vì sao phương án đó đúng hoặc sai giúp học sinh củng cố bài học ngay lập tức."),

    ...imageFigure(
      "12_xem_lai_dap_an_chi_tiet.png",
      "Hình 12: Cửa sổ xem lại chi tiết từng câu hỏi, đáp án đã chọn và lời giải thích chi tiết",
      560,
      350
    ),

    new Paragraph({ children: [new PageBreak()] })
  );

  // =========================================================================
  // PHẦN 8: BẢNG TỔNG HỢP CÂU HỎI THƯỜNG GẶP (FAQ) & XỬ LÝ SỰ CỐ
  // =========================================================================
  docChildren.push(
    h1("PHẦN 7: BẢNG TỔNG HỢP CÂU HỎI THƯỜNG GẶP (FAQ) & HỖ TRỢ KỸ THUẬT"),
    p("Dưới đây là các tình huống thực tế và cách giải quyết nhanh nhất dành cho học sinh:"),

    createTable(
      ["Tình Huống / Câu Hỏi", "Nguyên Nhân", "Cách Xử Lý Nhanh"],
      [
        [
          "Đăng nhập báo 'Tài khoản hoặc mật khẩu không chính xác'?",
          "Chưa chọn giáo viên hoặc chọn nhầm giáo viên khác, hoặc gõ sai mật khẩu.",
          "1. Kiểm tra lại xem đã chọn đúng '👨‍🏫 Nguyễn Phi Hùng - Thầy 5C' chưa.\n2. Bấm biểu tượng con mắt để xem lại mật khẩu xem có bị gõ nhầm chữ hoa/thường không."
        ],
        [
          "Màn hình thông báo 'Hiện chưa có kỳ thi nào đang mở'?",
          "Giáo viên chưa kích hoạt đề thi cho lớp bạn, hoặc bạn đang ở Cổng trung tâm mà chưa chọn giáo viên.",
          "Bấm nút 'Làm mới danh sách' ở góc phải. Nếu vẫn không thấy, báo ngay cho Thầy/Cô mở đề cho lớp."
        ],
        [
          "Đang làm bài bị mất mạng Wifi hoặc đứt kết nối 4G?",
          "Sự cố đường truyền Internet cục bộ.",
          "Hệ thống đã lưu các câu bạn đã chọn trên thiết bị. Bình tĩnh kết nối lại mạng và KHÔNG ĐÓNG TRÌNH DUYỆT. Khi có mạng lại tiếp tục làm và nộp bình thường."
        ],
        [
          "Làm bài trên điện thoại thông minh (smartphone) có được không?",
          "Hệ thống tương thích 100% với màn hình điện thoại.",
          "Hoàn toàn được. Trên điện thoại, học sinh bấm nút 'Bảng câu' ở thanh trên cùng để mở Bảng câu hỏi dạng ngăn kéo."
        ],
        [
          "Lỡ tay bấm nộp bài khi chưa làm xong hết câu?",
          "Học sinh bấm nhầm nút nộp bài.",
          "Hệ thống có cơ chế chặn tự động! Nếu còn câu chưa làm, màn hình đỏ sẽ hiện lên nhắc nhở bạn quay lại làm tiếp."
        ],
        [
          "Làm sao để đổi mật khẩu cá nhân?",
          "Mật khẩu mặc định dễ nhớ, cần bảo mật.",
          "Bấm vào tên học sinh ở góc trên bên phải -> Chọn 'Đổi mật khẩu' -> Nhập mật khẩu cũ (1234) và nhập mật khẩu mới."
        ]
      ],
      [28, 27, 45]
    ),

    p("", { spacingBefore: 200 }),

    calloutBox(
      "THÔNG TIN LIÊN HỆ HỖ TRỢ KỸ THUẬT PHÒNG THI",
      [
        "• Giáo viên phụ trách & Quản trị hệ thống: Thầy NGUYỄN PHI HÙNG",
        "• Đơn vị công tác: Trường THCS An Nhơn",
        "• Số điện thoại / Zalo hỗ trợ trực tiếp: 0938.750.424",
        "• Lời khuyên: Học sinh nên lưu lại số điện thoại hoặc kết nối Zalo với Thầy để được hỗ trợ tức thì khi gặp sự cố trong các buổi thi trực tuyến."
      ],
      "info"
    ),

    p("", { spacingBefore: 300 }),

    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 100 },
      children: [
        new TextRun({
          text: "--- CHÚC CÁC EM HỌC SINH ÔN TẬP TỐT VÀ ĐẠT KẾT QUẢ CAO NHẤT! ---",
          font: "Arial",
          size: 22,
          bold: true,
          color: COLOR.PRIMARY
        })
      ]
    })
  );

  // =========================================================================
  // KHỞI TẠO TÀI LIỆU DOCX CHUẨN ĐẦY ĐỦ
  // =========================================================================
  const doc = new Document({
    creator: "Thầy Nguyễn Phi Hùng",
    title: "Hướng Dẫn Học Sinh Đăng Nhập Và Thi Trực Tuyến - EduTest Pro 2.0",
    description: "Tài liệu hướng dẫn chi tiết dành cho học sinh đăng nhập và tham gia phòng thi trực tuyến EduTest Pro 2.0 có kèm ảnh chụp minh họa thực tế từng bước.",
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
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1200,    // ~2.1 cm
              bottom: 1200,
              left: 1200,
              right: 1200
            }
          }
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { before: 0, after: 100 },
                children: [
                  new TextRun({
                    text: "EduTest Pro 2.0  |  Hướng Dẫn Học Sinh Đăng Nhập & Tham Gia Phòng Thi",
                    font: "Arial",
                    size: 17, // 8.5pt
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
                alignment: AlignmentType.CENTER,
                spacing: { before: 100, after: 0 },
                children: [
                  new TextRun({
                    text: "Tác giả: Thầy Nguyễn Phi Hùng (Zalo 0938.750.424)  |  Trang ",
                    font: "Arial",
                    size: 18,
                    color: COLOR.MUTED_TEXT
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: "Arial",
                    size: 18,
                    bold: true,
                    color: COLOR.PRIMARY
                  }),
                  new TextRun({
                    text: " / ",
                    font: "Arial",
                    size: 18,
                    color: COLOR.MUTED_TEXT
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    font: "Arial",
                    size: 18,
                    bold: true,
                    color: COLOR.PRIMARY
                  })
                ]
              })
            ]
          })
        },
        children: docChildren
      }
    ]
  });

  const outFileName = "Huong_Dan_Hoc_Sinh_EduTest_Pro_2.0.docx";
  const outPath = path.join(__dirname, outFileName);
  console.log(`Đang xuất file sang: ${outPath}...`);

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outPath, buffer);

  const stats = fs.statSync(outPath);
  console.log(`XUẤT FILE THÀNH CÔNG!`);
  console.log(`- Tên file: ${outFileName}`);
  console.log(`- Kích thước: ${(stats.size / 1024 / 1024).toFixed(2)} MB (${stats.size} bytes)`);
}

buildStudentGuideDocx().catch(err => {
  console.error("Lỗi khi tạo file docx:", err);
});
