/**
 * Script tao file Huong_Dan_Su_Dung_EduTest_Pro_2.0.docx
 * Chuan hoa van phong sach huong dan chuyen nghiep, day du, chi tiet
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

// Mau sac chu dao (Design Palette)
const COLOR = {
  PRIMARY: "1E3A8A",      // Xanh Navy dam (Tieu de chinh)
  SECONDARY: "2563EB",    // Xanh Royal Blue (Tieu de phu, nhan manh)
  ACCENT_GREEN: "059669", // Xanh ngoc luc bao (Thanh cong, Tu luan)
  ACCENT_AMBER: "D97706", // Vang ho phach (Luu y, Canh bao)
  ACCENT_RED: "DC2626",   // Do ruby (Canh bao nguy hiem, Gian lan)
  DARK_TEXT: "1E293B",    // Xam den dam (Noi dung chinh)
  MUTED_TEXT: "64748B",   // Xam trung tinh (Ghi chu, phu de)
  LIGHT_BG: "F8FAFC",     // Nen xam rat nhat
  LIGHT_BLUE: "EFF6FF",   // Nen xanh nhat
  LIGHT_GREEN: "ECFDF5",  // Nen xanh la nhat
  LIGHT_AMBER: "FFFBEB",  // Nen vang nhat
  LIGHT_RED: "FEF2F2",    // Nen do nhat
  BORDER_LIGHT: "CBD5E1", // Vien xam nhat
  WHITE: "FFFFFF"
};

// Helper tao Paragraph co khoang cach chuan
function p(text = "", opts = {}) {
  const runs = [];
  if (typeof text === "string" && text.length > 0) {
    runs.push(new TextRun({
      text,
      font: "Arial",
      size: opts.size || 22, // 11pt default
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

// Helper tao Paragraph danh sach dau dong (Bullet item)
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

// Helper tao Heading 1, 2, 3
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

// Helper tao Hop thong bao (Callout Box)
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

// Helper tao bang chuan
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
                bold: isFirstCol && cellText.length > 4 && colIndex === 0
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

// BUILD TOAN BO TAI LIEU
async function generateDocx() {
  console.log("Bat dau khoi tao tai lieu...");

  // Kiem tra hinh anh minh hoa
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
  // TRANG BIA (COVER PAGE)
  // =========================================================================
  sectionsChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 60 },
      children: [
        new TextRun({
          text: "BỘ GIÁO DỤC VÀ ĐÀO TẠO - TÀI LIỆU HƯỚNG DẪN CÔNG NGHỆ GIÁO DỤC",
          font: "Arial",
          size: 19,
          bold: true,
          color: COLOR.MUTED_TEXT
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 60, after: 200 },
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
      spacing: { before: 180, after: 120 },
      children: [
        new TextRun({
          text: "HỆ THỐNG THI TRẮC NGHIỆM TRỰC TUYẾN",
          font: "Arial",
          size: 34,
          bold: true,
          color: COLOR.PRIMARY
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 140 },
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
      spacing: { before: 0, after: 240 },
      children: [
        new TextRun({
          text: "TÍCH HỢP TRỢ LÝ AI GEMINI & KIẾN TRÚC MÁY CHỦ PHÂN TÁN CENTRAL HUB",
          font: "Arial",
          size: 21,
          bold: true,
          color: "0F766E"
        })
      ]
    })
  );

  // Chen anh minh hoa neu co
  if (imageRunInstance) {
    sectionsChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 100, after: 240 },
        children: [imageRunInstance]
      })
    );
  }

  // Bang thong tin tac gia & phien ban tren trang bia
  const coverTable = new Table({
    width: { size: 90, type: WidthType.PERCENTAGE },
    alignment: AlignmentType.CENTER,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
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
            width: { size: 70, type: WidthType.PERCENTAGE },
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
            width: { size: 30, type: WidthType.PERCENTAGE },
            shading: { fill: COLOR.LIGHT_BG },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              left: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              right: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT }
            },
            children: [p("Kênh hỗ trợ / Zalo:", { bold: true, color: COLOR.PRIMARY })]
          }),
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            shading: { fill: COLOR.WHITE },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              left: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              right: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT }
            },
            children: [p("0938.750.424 (Hỗ trợ kỹ thuật 24/7)", { bold: true, color: COLOR.SECONDARY })]
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
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
            width: { size: 70, type: WidthType.PERCENTAGE },
            shading: { fill: COLOR.WHITE },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              left: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              right: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT }
            },
            children: [p("Web Serverless (Google Apps Script + Google Sheets + Gemini AI)", { color: COLOR.DARK_TEXT })]
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            shading: { fill: COLOR.LIGHT_BG },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              left: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              right: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT }
            },
            children: [p("Phiên bản:", { bold: true, color: COLOR.PRIMARY })]
          }),
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            shading: { fill: COLOR.WHITE },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              left: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT },
              right: { style: BorderStyle.SINGLE, size: 6, color: COLOR.BORDER_LIGHT }
            },
            children: [p("EduTest Pro 2.0 (Phiên bản chính thức phát hành năm 2026)", { color: COLOR.DARK_TEXT })]
          })
        ]
      })
    ]
  });

  sectionsChildren.push(
    coverTable,
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 0 },
      children: [
        new TextRun({
          text: "LƯU HÀNH NỘI BỘ - DÀNH CHO CÁN BỘ QUẢN LÝ, GIÁO VIÊN VÀ HỌC SINH",
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
    h1("MỤC LỤC TỔNG QUAN TÀI LIỆU"),
    p("Tài liệu hướng dẫn sử dụng chi tiết này bao gồm các chuyên đề chính như sau:"),
    bulletItem("PHẦN I:", "TỔNG QUAN HỆ THỐNG THI TRẮC NGHIỆM TRỰC TUYẾN EDUTEST PRO 2.0"),
    bulletItem("PHẦN II:", "HƯỚNG DẪN THIẾT LẬP MÁY CHỦ GOOGLE APPS SCRIPT & CƠ SỞ DỮ LIỆU GOOGLE SHEETS"),
    bulletItem("PHẦN III:", "HƯỚNG DẪN CHI TIẾT DÀNH CHO GIÁO VIÊN (CỔNG QUẢN TRỊ & SOẠN ĐỀ THI)"),
    bulletItem("PHẦN IV:", "HƯỚNG DẪN CHI TIẾT DÀNH CHO HỌC SINH (PHÒNG THI TRỰC TUYẾN)"),
    bulletItem("PHẦN V:", "MÔ HÌNH TRẠM TRUNG TÂM (CENTRAL HUB) & ĐIỀU PHỐI MÁY CHỦ PHÂN TÁN"),
    bulletItem("PHẦN VI:", "CÁC TIỆN ÍCH ĐẶC BIỆT: NHẠC NỀN THƯ GIÃN & THIẾT KẾ ĐA NỀN TẢNG"),
    bulletItem("PHẦN VII:", "BẢNG TỔNG HỢP CÂU HỎI THƯỜNG GẶP (FAQ) & HƯỚNG DẪN XỬ LÝ SỰ CỐ"),
    bulletItem("PHẦN VIII:", "THÔNG TIN LIÊN HỆ, BẢN QUYỀN & HỖ TRỢ KỸ THUẬT"),
    new Paragraph({ spacing: { before: 120, after: 120 } }),
    calloutBox("LƯU Ý TRƯỚC KHI ĐỌC VÀ THỰC HÀNH", [
      "Hệ thống EduTest Pro 2.0 hoạt động hoàn toàn trên nền tảng Web hiện đại, không cần cài đặt phần mềm phức tạp.",
      "Người dùng chỉ cần trình duyệt web (Google Chrome, Microsoft Edge, Cốc Cốc, Safari) có kết nối Internet.",
      "Đối với Giáo viên, toàn bộ dữ liệu học sinh, đề thi và bảng điểm được lưu trữ an toàn trong Google Drive cá nhân."
    ], "info"),
    new Paragraph({ children: [new PageBreak()] })
  );

  // =========================================================================
  // PHẦN I: TỔNG QUAN HỆ THỐNG
  // =========================================================================
  sectionsChildren.push(
    h1("PHẦN I: TỔNG QUAN HỆ THỐNG THI TRẮC NGHIỆM TRỰC TUYẾN EDUTEST PRO 2.0"),
    h2("1.1 Mục tiêu phát triển & Ý nghĩa thực tiễn"),
    p("Trong bối cảnh chuyển đổi số giáo dục đang diễn ra mạnh mẽ, nhu cầu kiểm tra, đánh giá thường xuyên và định kỳ của giáo viên ngày càng cao. Các công cụ truyền thống như Google Forms bộc lộ nhiều hạn chế về giao diện, thiếu cơ chế chống gian lận, không hỗ trợ định dạng câu hỏi trắc nghiệm Đúng/Sai 4 ý theo quy chuẩn mới của Bộ GD&ĐT, đồng thời rất khó phân quyền lớp học linh hoạt."),
    p("EduTest Pro 2.0 ra đời với mục tiêu mang đến cho các nhà trường, thầy cô giáo và học sinh một giải pháp phòng thi trực tuyến hiện đại, mạnh mẽ, độc lập và hoàn toàn miễn phí duy trì máy chủ."),
    
    h2("1.2 Kiến trúc công nghệ không máy chủ (Serverless)"),
    p("Hệ thống được xây dựng trên mô hình kiến trúc tiên tiến:"),
    bulletItem("Frontend Hiện Đại (Client-side):", "Được viết bằng HTML5 chuẩn SEO, CSS3 với phong cách Glassmorphism sang trọng và Vanilla JavaScript (ES6+). Tốc độ tải trang cực nhanh (dưới 1 giây), không phụ thuộc framework cồng kềnh, tối ưu trải nghiệm trên mọi thiết bị."),
    bulletItem("Backend Serverless (Google Apps Script - GAS):", "Sử dụng chính tài nguyên đám mây của Google để xử lý API xác thực đăng nhập, lưu trữ bài thi, cập nhật điểm và quản trị danh bạ."),
    bulletItem("Cơ Sở Dữ Liệu (Google Sheets):", "Toàn bộ dữ liệu được lưu trữ trực tiếp trên file Google Sheets cá nhân của Thầy/Cô. Thầy cô nắm giữ 100% dữ liệu, không lo rò rỉ đề thi hoặc mất quyền kiểm soát."),
    bulletItem("Trí Tuệ Nhân Tạo (Google Gemini AI):", "Tích hợp trực tiếp các mô hình AI mới nhất của Google (Gemini 3 Flash, Gemini 3.1 Flash-Lite, Gemini 2.5 Flash...) hỗ trợ bóc tách đề thi tự động từ file Word hoặc PDF siêu tốc."),

    h2("1.3 Bảng so sánh tính năng vượt trội"),
    p("Bảng dưới đây so sánh các tính năng cốt lõi giữa EduTest Pro 2.0 và các giải pháp thông dụng:"),
    createTable(
      ["Tiêu chí so sánh", "Google Forms thông thường", "Phần mềm thi trực tuyến trả phí", "EduTest Pro 2.0"],
      [
        ["Chi phí máy chủ", "Miễn phí", "Mất phí thuê bao hàng tháng/năm", "Hoàn toàn miễn phí trọn đời"],
        ["Quyền sở hữu CSDL", "Trên Google cá nhân", "Lưu trên server của nhà cung cấp", "100% lưu trên Google Sheets cá nhân GV"],
        ["Hỗ trợ AI bóc tách đề", "Không có", "Có (giới hạn lượt dùng)", "Tích hợp Gemini AI không giới hạn"],
        ["Cấu trúc trắc nghiệm Đúng/Sai", "Rất khó làm, chấm thủ công", "Một số nơi hỗ trợ", "Chuẩn 100% Bộ GD&ĐT (10% - 25% - 50% - 100%)"],
        ["Giám sát toàn màn hình", "Không có", "Có", "Có sẵn, phát hiện thoát tab và cảnh báo"],
        ["Xuất đề thi ra Word (.docx)", "Không có", "Có", "Xuất 1 chạm chuẩn ma trận đề thi BGD"],
        ["Xuất bảng điểm Excel (.xlsx)", "Xuất bảng tính thô", "Có xuất bảng điểm", "Xuất bảng điểm trắc nghiệm & tự luận chuẩn"],
        ["Nhạc nền thư giãn tập trung", "Không có", "Không có", "Tích hợp widget nhạc nền bản quyền du dương"],
        ["Mô hình Trạm Trung Tâm (Hub)", "Không có", "Có nhưng phức tạp", "Tự động phân luồng học sinh theo GV"]
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
    p("Hệ thống EduTest Pro 2.0 sử dụng Google Sheets làm cơ sở dữ liệu và Google Apps Script đóng vai trò máy chủ xử lý dữ liệu (Backend). Quá trình cài đặt chỉ cần thực hiện 1 lần duy nhất trong khoảng 3 đến 5 phút."),

    h2("2.1 Các bước cài đặt chi tiết từng bước"),
    bulletItem("Bước 1:", "Mở trình duyệt và truy cập Google Drive cá nhân (drive.google.com). Bấm nút 'Mới' > 'Google Trang tính' để tạo một bảng tính trắng."),
    bulletItem("Bước 2:", "Đặt tên cho bảng tính, ví dụ: 'CSDL_EduTest_Pro_2.0'."),
    bulletItem("Bước 3:", "Trên thanh menu của Google Sheets, chọn 'Tiện ích mở rộng' (Extensions) > chọn 'Apps Script'."),
    bulletItem("Bước 4:", "Một tab soạn thảo mã nguồn sẽ mở ra. Xóa sạch mọi mã mặc định trong file Code.gs. Mở file Code.gs trong thư mục mã nguồn của EduTest Pro 2.0, sao chép toàn bộ nội dung và dán vào Apps Script."),
    bulletItem("Bước 5:", "Nhấn phím Ctrl + S (hoặc bấm biểu tượng Đĩa mềm) để lưu lại dự án."),

    h2("2.2 Khởi tạo tự động 7 Sheet dữ liệu chuẩn hóa"),
    p("Trong trình soạn thảo Apps Script, tại thanh công cụ trên cùng:"),
    bulletItem("1.", "Tìm ô chọn hàm thực thi (thường mặc định là myFunction), bấm vào chọn hàm 'initDatabase'."),
    bulletItem("2.", "Bấm nút 'Chạy' (Run). Lần đầu tiên chạy, Google sẽ yêu cầu 'Ủy quyền truy cập' (Authorization Required)."),
    bulletItem("3.", "Bấm 'Xem lại quyền' (Review permissions) > Chọn tài khoản Google của bạn > Bấm 'Nâng cao' (Advanced) > Bấm 'Đi tới [Tên dự án] (không an toàn)' > Bấm 'Cho phép' (Allow)."),
    bulletItem("4.", "Hàm sẽ tự động chạy và tạo ngay 7 bảng dữ liệu chuẩn cấu trúc trong Google Sheets."),

    calloutBox("CẤU TRÚC 7 BẢNG DỮ LIỆU TỰ ĐỘNG KHỞI TẠO", [
      "1. DATA_HOCSINH: Quản lý danh sách học sinh (Tài khoản, Mật khẩu, Lớp, Họ tên, Ngày sinh, Giới tính, Trường).",
      "2. DATA_GIAOVIEN: Quản lý tài khoản giáo viên (Tài khoản GV, Mật khẩu, Họ tên, Lớp giảng dạy, Trường).",
      "3. DATA_DETHI: Lưu trữ thông tin đề thi, thời gian, trạng thái Mở/Khóa, cấu hình xem điểm, chuỗi JSON câu hỏi.",
      "4. DATA_KETQUA: Lưu bảng điểm trắc nghiệm, thời gian nộp, số câu đúng và toàn bộ nhật ký chọn đáp án của thí sinh.",
      "5. DATA_TULUAN: Lưu câu trả lời tự luận chi tiết theo từng cột câu hỏi để Giáo viên chấm điểm và nhận xét.",
      "6. HUB_SERVERS: Danh bạ máy chủ của các Giáo viên phục vụ mô hình Trạm Trung Tâm của trường.",
      "7. HUB_STUDENTS: Danh bạ học sinh hỗ trợ cơ chế tự động định tuyến học sinh về đúng server của thầy cô."
    ], "success"),

    h2("2.3 Triển khai thành Web App (Deploy as Web App)"),
    p("Để hệ thống giao diện web có thể giao tiếp với Google Sheets, Thầy/Cô cần xuất bản Apps Script dưới dạng Ứng dụng Web:"),
    bulletItem("1.", "Bấm vào nút màu xanh 'Triển khai' (Deploy) ở góc trên bên phải màn hình Apps Script."),
    bulletItem("2.", "Chọn 'Tùy chọn triển khai mới' (New deployment)."),
    bulletItem("3.", "Bấm biểu tượng Bánh răng (Cài đặt) bên cạnh mục 'Chọn loại', chọn 'Ứng dụng web' (Web app)."),
    bulletItem("4.", "Cấu hình 2 thông số BẮT BUỘC như sau:"),
    bulletItem("   • Thực thi dưới dạng (Execute as):", "Chọn 'Tôi' (Me - địa chỉ email của Thầy/Cô)."),
    bulletItem("   • Ai có quyền truy cập (Who has access):", "BẮT BUỘC chọn 'Bất kỳ ai' (Anyone). Nếu chọn mục khác, học sinh sẽ bị lỗi phân quyền không thể đăng nhập."),
    bulletItem("5.", "Bấm nút 'Triển khai' (Deploy)."),
    bulletItem("6.", "Sao chép dòng 'URL ứng dụng web' (Web app URL) có đuôi /exec (Ví dụ: https://script.google.com/macros/s/.../exec)."),

    calloutBox("CẢNH BÁO KHI CẬP NHẬT MÃ NGUỒN APPS SCRIPT", [
      "Mỗi khi Thầy/Cô có chỉnh sửa bất kỳ dòng mã nào trong Code.gs, Thầy/Cô BẮT BUỘC phải tạo một bản triển khai mới:",
      "Bấm Triển khai > Quản lý bản triển khai (Manage deployments) > Bấm biểu tượng Cây bút chì chỉnh sửa > Chọn 'Phiên bản mới' (New version) > Bấm Triển khai.",
      "Nếu không chọn Phiên bản mới, Google sẽ vẫn chạy mã nguồn cũ!"
    ], "warning"),

    new Paragraph({ children: [new PageBreak()] })
  );

  // =========================================================================
  // PHẦN III: HƯỚNG DẪN CHI TIẾT DÀNH CHO GIÁO VIÊN
  // =========================================================================
  sectionsChildren.push(
    h1("PHẦN III: HƯỚNG DẪN CHI TIẾT DÀNH CHO GIÁO VIÊN (CỔNG QUẢN TRỊ)"),
    p("Cổng Giáo Viên (teacher_dashboard.html) là trung tâm điều hành toàn diện của Thầy/Cô, tích hợp 3 phân hệ chính: Tạo & Quản lý Đề Thi, Xem Kết Quả & Thống Kê, Quản Lý Học Sinh."),

    h2("3.1 Đăng nhập & Quản lý Tài khoản Giáo viên"),
    p("Truy cập trang đăng nhập (index.html), chọn tab 'Giáo viên'. Nhập tài khoản và mật khẩu (Mặc định tài khoản thử nghiệm: GV001, mật khẩu: 123)."),
    p("Sau khi đăng nhập thành công, Thầy/Cô có thể bấm vào ảnh đại diện ở góc phải trên thanh điều hướng để:"),
    bulletItem("•", "Xem thông tin cá nhân (Mã GV, Họ tên, Các lớp được phân công giảng dạy)."),
    bulletItem("•", "Đổi mật khẩu cá nhân để bảo mật tài khoản."),
    bulletItem("•", "Kiểm tra trạng thái kết nối Google Sheet cá nhân thông qua nút đèn báo trạng thái màu xanh."),

    h2("3.2 Cấu hình Trợ lý AI Google Gemini"),
    p("EduTest Pro 2.0 tích hợp Trợ lý AI Gemini giúp bóc tách đề thi tự động chỉ trong vài giây. Thầy/Cô thực hiện cấu hình như sau:"),
    bulletItem("1.", "Bấm nút 'Cấu hình Trợ Lý AI' ở banner phía trên màn hình."),
    bulletItem("2. Lấy API Key miễn phí:", "Truy cập https://aistudio.google.com, đăng nhập tài khoản Google và bấm 'Create API key'. Sao chép chuỗi khóa và dán vào ô 'Gemini API Key' trên hệ thống."),
    bulletItem("3. Chọn Mô hình AI tối ưu:", "Hệ thống hỗ trợ danh sách mô hình AI đa dạng:"),
    bulletItem("   - Gemini 3 Flash Preview:", "Mô hình thế hệ mới nhất, tốc độ cực nhanh, bóc tách đề thi chuẩn xác tuyệt đối (Khuyên dùng)."),
    bulletItem("   - Gemini 3.1 Flash-Lite:", "Phiên bản siêu nhẹ, tiết kiệm tài nguyên token tối đa."),
    bulletItem("   - Gemini 2.5 Flash:", "Mô hình ổn định, xử lý câu hỏi phức tạp xuất sắc."),
    bulletItem("   - Gemini 3.7 Flash:", "Mô hình cao cấp, suy luận logic mạnh mẽ đối với các đề thi có nhiều ký hiệu đặc biệt."),
    bulletItem("4.", "Bấm 'Lưu Cấu Hình AI'. Khóa API được lưu cục bộ trên trình duyệt máy tính của Thầy/Cô (Local Storage), hoàn toàn bảo mật và không gửi lên bất kỳ máy chủ nào khác."),

    h2("3.3 Quy trình Soạn đề & Bóc tách Đề thi Thông minh"),
    p("Hệ thống cung cấp 3 phương thức tạo đề thi vô cùng linh hoạt:"),

    h3("Phương thức 1: Bóc tách tự động từ File Word (.docx) hoặc PDF"),
    bulletItem("•", "Kéo và thả file Word (.docx) hoặc file PDF đề thi vào vùng Dropzone (hoặc bấm nút 'Chọn File Đề Thi')."),
    bulletItem("• Cách 1 - Bấm nút 'Bóc Tách Bằng Thuật Toán (Chuẩn 100%)':", "Sử dụng bộ bóc tách regex nội bộ siêu tốc, tự động nhận diện Câu 1, Câu 2... các phương án A, B, C, D và đáp án gạch chân/in đậm. Tốc độ xử lý chỉ mất 0.2 giây!"),
    bulletItem("• Cách 2 - Bấm nút 'Bóc Tách Bằng Gemini AI':", "Sử dụng trí tuệ nhân tạo để đọc hiểu đề thi, phân loại chính xác đâu là câu trắc nghiệm 4 lựa chọn (Phần I), đâu là câu hỏi Đúng/Sai 4 ý (Phần II) và đâu là câu hỏi Tự luận (Phần III)."),

    h3("Phương thức 2: Dán trực tiếp văn bản đề thi thô"),
    p("Thầy/Cô có thể bấm vào dòng 'Hoặc dán trực tiếp nội dung văn bản đề thi', dán nội dung văn bản đề thi từ bất kỳ tài liệu nào và bấm nút Bóc tách."),

    h3("Phương thức 3: Soạn câu hỏi thủ công & Chỉnh sửa trực tiếp"),
    p("Tại cột bên phải (Bản xem trước & Chỉnh sửa đề thi), Thầy/Cô bấm nút 'Thêm Câu Hỏi' để chọn:"),
    bulletItem("• Phần I - Trắc nghiệm Nhiều lựa chọn:", "Nhập nội dung câu hỏi, 4 phương án A, B, C, D, tích chọn đáp án đúng và nhập điểm số."),
    bulletItem("• Phần II - Trắc nghiệm Đúng / Sai:", "Nhập nội dung câu hỏi và 4 ý khẳng định a, b, c, d. Tích chọn Đúng hoặc Sai cho từng ý. Điểm số được chấm theo % chuẩn quy định của Bộ GD&ĐT."),
    bulletItem("• Phần III - Câu hỏi Tự Luận:", "Nhập câu hỏi tự luận để học sinh làm bài tự luận trực tiếp trên web."),

    calloutBox("QUY TẮC CHẤM TRẮC NGHIỆM ĐÚNG/SAI CHUẨN BỘ GIÁO DỤC & ĐÀO TẠO", [
      "Theo định dạng đề thi mới của Bộ GD&ĐT, mỗi câu hỏi Đúng/Sai gồm 4 ý a, b, c, d có thang điểm chấm lũy tiến:",
      "• Thí sinh chỉ trả lời ĐÚNG 1 Ý: Được tính 10% số điểm của câu hỏi.",
      "• Thí sinh trả lời ĐÚNG 2 Ý: Được tính 25% số điểm của câu hỏi.",
      "• Thí sinh trả lời ĐÚNG 3 Ý: Được tính 50% số điểm của câu hỏi.",
      "• Thí sinh trả lời ĐÚNG CẢ 4 Ý: Được tính 100% số điểm của câu hỏi.",
      "Hệ thống EduTest Pro 2.0 tự động tính toán chính xác theo thuật toán này, giải phóng hoàn toàn sức lao động cho giáo viên!"
    ], "info"),

    h3("Các công cụ tiện ích hỗ trợ soạn đề"),
    bulletItem("• Nút '⚡ Chia đều 10đ':", "Tự động phân bổ lại điểm số của tất cả các câu hỏi trong đề sao cho tổng điểm bằng đúng 10.0 điểm tròn trịa."),
    bulletItem("• Nút 'Xuất DOCX':", "Xuất toàn bộ đề thi kèm bảng đáp án chi tiết ra file Word (.docx) chuẩn mẫu đề thi Bộ GD&ĐT chỉ với 1 click."),

    h2("3.4 Cấu hình Kỳ kiểm tra & Thiết lập Phòng thi"),
    p("Tại khung Cấu hình chung kỳ kiểm tra, Thầy/Cô thiết lập các thông số sau:"),
    bulletItem("• Tên kỳ kiểm tra:", "Ví dụ: 'Kiểm tra 1 tiết Toán hình học kỳ 2'."),
    bulletItem("• Thời gian làm bài:", "Quy định số phút làm bài (từ 5 đến 180 phút)."),
    bulletItem("• Trạng thái kỳ thi:", "Gạt công tắc sang Mở (học sinh thấy bài thi và vào làm) hoặc Đóng (tạm ẩn bài thi)."),
    bulletItem("• Chế độ Xem lại bài & Đáp án (Học sinh):", "Có 2 chế độ đặc biệt quan trọng:"),
    bulletItem("   1) Ôn tập / Luyện tập:", "Học sinh được làm bài nhiều lần (ghi nhận điểm lần nộp cuối cùng). Sau khi nộp bài, học sinh được xem lại toàn bộ đề thi, đáp án mình chọn và đáp án đúng."),
    bulletItem("   2) Thi / Kiểm tra chính thức:", "Học sinh CHỈ ĐƯỢC LÀM 1 LẦN DUY NHẤT. Sau khi nộp bài, hệ thống khóa bài thi, không cho phép làm lại và khóa tính năng xem lại đề thi & đáp án để bảo mật."),
    bulletItem("• Giám sát toàn màn hình & Chống gian lận (Fullscreen Proctoring):", "Khi bật chế độ Thi chính thức, hệ thống tự động kích hoạt tính năng giám sát toàn màn hình:"),
    bulletItem("   -", "Học sinh bắt buộc phải phóng to màn hình tối đa khi làm bài."),
    bulletItem("   -", "Nếu học sinh bấm phím thoát màn hình hoặc mở tab khác để tra cứu tài liệu, hệ thống sẽ bật cảnh báo đỏ."),
    bulletItem("   -", "Thầy/Cô có thể cấu hình số lần vi phạm cho phép (Ví dụ: 5 lần). Nếu học sinh vi phạm đến lần thứ 6, hệ thống sẽ TỰ ĐỘNG THU VÀ NỘP BÀI NGAY LẬP TỨC!"),
    bulletItem("• Cấu hình Xem điểm sau khi nộp:", "Tùy chọn cho học sinh biết điểm số ngay sau khi nộp bài hoặc Khóa điểm số để giáo viên công bố sau."),
    bulletItem("• Lớp được phép thi:", "Tích chọn Khối (Khối 6, 7, 8, 9...) và tích chọn các lớp cụ thể được phép tham gia thi."),

    h2("3.5 Quản lý Học sinh & Đổi mật khẩu hàng loạt"),
    p("Tại Tab 'Quản Lý Học Sinh' (tabStudents):"),
    bulletItem("• Bộ lọc Khối & Lớp:", "Tích chọn nhanh các khối và lớp cần xem danh sách học sinh."),
    bulletItem("• Thêm học sinh:", "Bấm nút '+ Thêm học sinh' để bổ sung học sinh mới (Tài khoản, Mật khẩu, Lớp, Họ tên, Ngày sinh, Giới tính, Trường)."),
    bulletItem("• Sửa thông tin & Cấp lại mật khẩu lẻ:", "Trên từng dòng học sinh, bấm nút hình Bánh răng hoặc Ổ khóa để cấp lại mật khẩu mới cho học sinh quên mật khẩu."),
    bulletItem("• Đổi mật khẩu HÀNG LOẠT (Batch Password Reset):", "Bấm nút 'Đổi MK hàng loạt', chọn Khối hoặc Lớp cần đổi, nhập mật khẩu chung mới (Ví dụ: 123) và bấm xác nhận. Hệ thống sẽ tự động cập nhật hàng loạt trong CSDL."),
    bulletItem("• Xuất Excel Danh sách học sinh:", "Xuất toàn bộ danh sách học sinh kèm mật khẩu ra file Excel (.xlsx)."),

    h2("3.6 Thống kê Kết quả & Quản lý Điểm số"),
    p("Tại Tab 'Xem Kết Quả & Thống Kê' (tabResults):"),
    bulletItem("• 4 Thẻ chỉ số KPI:", "Hiển thị Tổng số bài thi đã nộp, Điểm trung bình cả lớp, Điểm cao nhất / thấp nhất và Tỉ lệ đạt chuẩn năng lực (>= 5.0 điểm)."),
    bulletItem("• Bộ lọc kết quả:", "Lọc theo từng Đề thi, theo từng Lớp học, hoặc theo trạng thái nộp bài (Tất cả / Đã làm / Chưa làm)."),
    bulletItem("• Tùy chọn 'Hiện đủ danh sách lớp theo CSDL gốc':", "Giúp giáo viên đối chiếu ngay những học sinh nào chưa làm bài thi để đôn đốc nhắc nhở."),
    bulletItem("• Xuất Excel Trắc nghiệm (.xlsx):", "Tải bảng điểm tổng hợp chi tiết đầy đủ thông tin thí sinh, điểm số, số câu đúng và thời gian nộp bài."),
    bulletItem("• Xuất Excel Tự luận (.xlsx):", "Tải danh sách bài làm tự luận của thí sinh được chia theo từng cột câu hỏi để giáo viên chấm thi nhanh chóng."),
    bulletItem("• Xem chi tiết bài làm & Xóa bài thi:", "Bấm nút 'Chi tiết' để xem lại toàn bộ bài làm của học sinh (từng câu chọn gì, đúng hay sai). Bấm nút 'Xóa bài' nếu muốn cho phép học sinh thi lại do sự cố bất khả kháng."),

    new Paragraph({ children: [new PageBreak()] })
  );

  // =========================================================================
  // PHẦN IV: HƯỚNG DẪN CHI TIẾT DÀNH CHO HỌC SINH
  // =========================================================================
  sectionsChildren.push(
    h1("PHẦN IV: HƯỚNG DẪN CHI TIẾT DÀNH CHO HỌC SINH (PHÒNG THI TRỰC TUYẾN)"),
    p("Cổng Học Sinh (student_dashboard.html) được thiết kế tối giản, tập trung và trực quan, giúp thí sinh làm bài thi trắc nghiệm một cách thuận tiện nhất."),

    h2("4.1 Đăng nhập & Lưu ý Sống còn về Chọn Thầy/Cô phụ trách"),
    p("Khi truy cập trang đăng nhập (index.html):"),
    bulletItem("1.", "Giữ nguyên vai trò mặc định là 'Học sinh'."),
    bulletItem("2. BẮT BUỘC CHỌN ĐÚNG THẦY/CÔ PHỤ TRÁCH:", "Tại mục '⚠️ THẦY / CÔ PHỤ TRÁCH PHÒNG THI', bấm vào danh sách thả xuống và CHỌN ĐÚNG TÊN GIÁO VIÊN đang phụ trách kiểm tra lớp của mình."),
    bulletItem("3.", "Nhập Tài khoản học sinh (Mã HS do nhà trường/thầy cô cấp, ví dụ: HS001)."),
    bulletItem("4.", "Nhập Mật khẩu và bấm nút 'Đăng Nhập'."),

    calloutBox("CẢNH BÁO NGUY HIỂM TỪ HỆ THỐNG DÀNH CHO HỌC SINH", [
      "Học sinh BẮT BUỘC phải chọn đúng tên Thầy/Cô phụ trách lớp mình.",
      "Nếu học sinh KHÔNG CHỌN hoặc CHỌN SAI THẦY/CÔ: Học sinh sẽ KHÔNG THỂ ĐĂNG NHẬP ĐƯỢC hoặc bài làm sẽ bị gửi nhầm sang máy chủ của giáo viên khác, dẫn tới mất bài thi và bị tính 0 điểm!",
      "Mẹo: Nếu Thầy/Cô gửi cho học sinh đường link có sẵn mã phòng thi (link có đuôi ?server=...), hệ thống sẽ tự động nhận diện đúng Thầy/Cô mà học sinh không cần chọn thủ công."
    ], "danger"),

    h2("4.2 Danh sách Kỳ thi đang mở"),
    p("Sau khi đăng nhập thành công:"),
    bulletItem("•", "Học sinh sẽ nhìn thấy Thẻ thông tin cá nhân của mình: Họ tên, Mã HS, Lớp, Ngày sinh, Giới tính, Trường học."),
    bulletItem("•", "Mục 'Kỳ Thi Đang Mở Cho Lớp Bạn' chỉ hiển thị những bài thi nào đang ở trạng thái MỞ và ĐƯỢC PHÂN QUYỀN cho đúng lớp của học sinh."),
    bulletItem("•", "Trên từng thẻ bài thi sẽ hiển thị rõ: Tên bài kiểm tra, Thời gian làm bài (phút), Số lượng câu hỏi và Chế độ thi (Ôn tập hoặc Thi chính thức)."),
    bulletItem("•", "Bấm nút 'Vào Làm Bài' để bước vào phòng thi trực tuyến."),

    h2("4.3 Giao diện Phòng thi Trực tuyến & Quy định làm bài"),
    p("Khi vào phòng thi, màn hình sẽ chuyển sang chế độ phòng thi tập trung:"),
    bulletItem("• Đồng hồ đếm ngược (Countdown Timer):", "Hiển thị chính xác thời gian còn lại từng giây. Khi thời gian còn dưới 5 phút, đồng hồ sẽ chuyển sang màu đỏ cảnh báo. Khi hết giờ, hệ thống TỰ ĐỘNG THU VÀ NỘP BÀI."),
    bulletItem("• Bảng câu hỏi (Palette):", "Nằm ở cột bên phải (trên điện thoại có nút 'Bảng câu' để mở ngăn kéo). Các ô số câu hỏi sẽ tự động đổi màu:"),
    bulletItem("   - Màu xám nhạt:", "Câu hỏi chưa làm."),
    bulletItem("   - Màu xanh lá cây:", "Câu hỏi đã hoàn thành."),
    bulletItem("   - Bấm vào số câu bất kỳ để cuộn nhanh đến câu hỏi đó."),
    bulletItem("• Cách trả lời 3 dạng câu hỏi:"),
    bulletItem("   1) Phần I (Trắc nghiệm 4 lựa chọn):", "Bấm chọn 1 trong 4 đáp án A, B, C hoặc D."),
    bulletItem("   2) Phần II (Trắc nghiệm Đúng/Sai):", "Đối với từng ý a, b, c, d, bấm nút 'Đúng' hoặc 'Sai'."),
    bulletItem("   3) Phần III (Tự luận):", "Gõ câu trả lời trực tiếp vào khung văn bản tự luận bên dưới câu hỏi."),

    h2("4.4 Cơ chế Giám sát Chống gian lận (Proctoring)"),
    bulletItem("•", "Đối với bài thi chính thức, hệ thống sẽ yêu cầu chuyển sang chế độ Toàn màn hình (Fullscreen)."),
    bulletItem("•", "Nếu học sinh bấm phím thoát toàn màn hình, chuyển tab hoặc mở cửa sổ khác, hệ thống sẽ phát tín hiệu cảnh báo màu đỏ và ghi nhận số lần vi phạm."),
    bulletItem("•", "Nếu số lần vi phạm vượt quá mức cho phép của đề thi, hệ thống sẽ TỰ ĐỘNG KHÓA VÀ NỘP BÀI NGAY LẬP TỨC!"),

    h2("4.5 Nộp bài & Màn hình Kết quả Vinh danh"),
    bulletItem("•", "Khi làm xong, học sinh bấm nút 'Nộp Bài'. Hệ thống sẽ hiển thị hộp thoại xác nhận số câu đã hoàn thành."),
    bulletItem("•", "Màn hình Vinh danh: Hiển thị cúp vàng 🏆 cùng lời chúc mừng, điểm số trắc nghiệm đạt được, số câu trả lời đúng và thời gian hoàn thành."),
    bulletItem("• Xem lại bài thi:", "Nếu là bài thi Ôn tập / Luyện tập, học sinh có thể cuộn xuống để xem lại chi tiết từng câu hỏi, đáp án mình đã chọn và đáp án đúng màu xanh lá để rút kinh nghiệm học tập."),

    new Paragraph({ children: [new PageBreak()] })
  );

  // =========================================================================
  // PHẦN V: KIẾN TRÚC TRẠM TRUNG TÂM (CENTRAL HUB)
  // =========================================================================
  sectionsChildren.push(
    h1("PHẦN V: MÔ HÌNH TRẠM TRUNG TÂM (CENTRAL HUB) & MÁY CHỦ PHÂN TÁN"),
    h2("5.1 Tại sao cần Mô hình Trạm Trung Tâm?"),
    p("Khi một trường học tổ chức thi trực tuyến cho hàng nghìn học sinh cùng lúc, nếu tất cả truy cập vào 1 file Google Sheet duy nhất sẽ dễ xảy ra hiện tượng nghẽn mạng do giới hạn lưu lượng (Quota) của Google Apps Script."),
    p("EduTest Pro 2.0 giải quyết triệt để vấn đề này bằng kiến trúc Trạm Trung Tâm (Central Hub) kết hợp Máy chủ Giáo viên Phân tán (Distributed Teacher Servers):"),
    bulletItem("1. Trạm Trung Tâm (Hub Server):", "Đóng vai trò là bảng chỉ dẫn và danh bạ máy chủ của toàn trường. Nơi đây lưu danh sách các Thầy/Cô và đường dẫn Web App của từng Thầy/Cô."),
    bulletItem("2. Máy chủ Giáo viên riêng biệt:", "Mỗi Thầy/Cô sở hữu một Google Sheet độc lập. Dữ liệu đề thi, danh sách học sinh và kết quả chấm điểm của lớp nào sẽ chỉ nằm trên Google Sheet của giáo viên phụ trách lớp đó."),
    bulletItem("3. Tự động Định tuyến (Smart Routing):", "Khi học sinh đăng nhập, hệ thống sẽ tự động tra cứu xem học sinh thuộc lớp nào, do Thầy/Cô nào phụ trách và chuyển hướng kết nối an toàn đến đúng máy chủ của Thầy/Cô đó mà học sinh không hề nhận thấy sự phức tạp."),

    h2("5.2 Quy trình Đồng bộ Dữ liệu lên Trạm Trung Tâm"),
    bulletItem("Bước 1:", "Giáo viên hoàn thiện danh sách học sinh các lớp mình giảng dạy tại Google Sheet cá nhân."),
    bulletItem("Bước 2:", "Tại Bảng điều khiển Giáo viên, vào Tab 'Quản Lý Học Sinh', bấm nút '🌐 Đồng bộ Trạm Trung Tâm'."),
    bulletItem("Bước 3:", "Hệ thống sẽ tự động gửi danh bạ mã học sinh của Thầy/Cô lên bảng HUB_STUDENTS của Trạm Trung Tâm."),
    bulletItem("Bước 4:", "Từ thời điểm này, học sinh của Thầy/Cô chỉ cần vào trang đăng nhập chung là có thể kết nối thông suốt!"),

    new Paragraph({ children: [new PageBreak()] })
  );

  // =========================================================================
  // PHẦN VI: TIỆN ÍCH ĐẶC BIỆT & THIẾT KẾ ĐA NỀN TẢNG
  // =========================================================================
  sectionsChildren.push(
    h1("PHẦN VI: CÁC TIỆN ÍCH ĐẶC BIỆT: NHẠC NỀN & ĐA NỀN TẢNG"),
    h2("6.1 Widget Nhạc Nền Du Dương 'Love Story' & 'Sealed With A Kiss'"),
    p("Khoa học đã chứng minh âm nhạc êm dịu ở tần số phù hợp giúp não bộ thư giãn, giảm áp lực phòng thi và gia tăng khả năng tập trung khi làm bài trắc nghiệm. EduTest Pro 2.0 tích hợp sẵn widget nghe nhạc độc đáo:"),
    bulletItem("• Vị trí tinh tế:", "Widget biểu tượng Loa phát nhạc nhỏ gọn nằm ở góc trên bên phải thanh điều hướng, không chiếm diện tích màn hình."),
    bulletItem("• Bản quyền âm nhạc:", "Tích hợp sẵn 2 bản nhạc trữ tình bất hủ không lời: 'Love Story' và 'Sealed With A Kiss'."),
    bulletItem("• Cơ chế phát thông minh:", "Mỗi khi người dùng mở trang web, hệ thống tự động chọn ngẫu nhiên 1 trong 2 bản nhạc và phát lặp lại liên tục (loop) bản nhạc đó với âm lượng mặc định 30% dịu nhẹ."),
    bulletItem("• Bảng điều khiển Pop-up đầy đủ:", "Bấm vào biểu tượng loa để mở bảng điều khiển: Nút Play/Pause, Nút chuyển bài nhanh (⏭️), Nút Tắt/Bật tiếng (Mute) và 4 nút chọn nhanh âm lượng: 15%, 30%, 50%, 80%."),

    h2("6.2 Trải nghiệm Đáp ứng Đa nền tảng (Responsive Design)"),
    p("Hệ thống được thiết kế tỉ mỉ theo chuẩn Responsive Mobile First:"),
    bulletItem("• Trên Máy tính để bàn & Laptop:", "Giao diện 2 cột rộng rãi, bản xem trước đề thi và bảng điều hướng câu hỏi bám dính (sticky) tiện lợi khi cuộn trang."),
    bulletItem("• Trên Điện thoại Smartphone & Máy tính bảng:", "Thanh điều hướng co giãn linh hoạt, bảng câu hỏi chuyển thành ngăn kéo trượt (Mobile Drawer) mượt mà, cỡ chữ to rõ ràng, các nút bấm có diện tích chạm đạt chuẩn công thái học."),

    new Paragraph({ children: [new PageBreak()] })
  );

  // =========================================================================
  // PHẦN VII: CÂU HỎI THƯỜNG GẶP (FAQ) & XỬ LÝ SỰ CỐ
  // =========================================================================
  sectionsChildren.push(
    h1("PHẦN VII: BẢNG TỔNG HỢP CÂU HỎI THƯỜNG GẶP (FAQ) & XỬ LÝ SỰ CỐ"),
    
    h2("7.1 Học sinh không đăng nhập được hoặc báo lỗi tài khoản?"),
    p("Nguyên nhân & Cách khắc phục:"),
    bulletItem("1. Chưa chọn đúng Thầy/Cô:", "Kiểm tra xem học sinh đã bấm chọn đúng tên Giáo viên phụ trách lớp mình ở ô chọn trên cùng chưa."),
    bulletItem("2. Sai định dạng tài khoản:", "Kiểm tra mã học sinh trong Google Sheet (Cột 'Tài khoản HS' trong DATA_HOCSINH). Chú ý chữ hoa/chữ thường và khoảng trắng thừa."),
    bulletItem("3. Chưa cấp quyền Anyone cho Web App:", "Giáo viên kiểm tra lại cấu hình Deploy của Web App xem mục 'Who has access' đã chọn 'Anyone' chưa."),

    h2("7.2 Đang làm bài thi mà bị mất điện hoặc rớt mạng Internet thì sao?"),
    p("EduTest Pro 2.0 có cơ chế lưu vết bài làm tạm thời trên Local Storage của trình duyệt:"),
    bulletItem("•", "Toàn bộ các đáp án học sinh đã chọn được lưu liên tục trên máy của học sinh."),
    bulletItem("•", "Khi có điện hoặc mạng trở lại, học sinh tải lại trang web là có thể tiếp tục làm bài mà không bị mất các câu trả lời trước đó."),
    bulletItem("•", "Đồng hồ đếm ngược được đồng bộ theo thời gian thực của máy chủ, đảm bảo tính công bằng tuyệt đối."),

    h2("7.3 Làm thế nào để cho một học sinh thi lại khi gặp sự cố bất khả kháng?"),
    bulletItem("• Bước 1:", "Giáo viên vào Bảng điều khiển Giáo viên > Tab 'Xem Kết Quả & Thống Kê'."),
    bulletItem("• Bước 2:", "Chọn đúng Kỳ kiểm tra và Lớp của học sinh đó."),
    bulletItem("• Bước 3:", "Tìm tên học sinh trong bảng điểm, bấm nút 'Xóa bài thi' màu đỏ ở cột thao tác."),
    bulletItem("• Bước 4:", "Sau khi xóa, tài khoản của học sinh sẽ được mở khóa và học sinh có thể vào phòng thi làm lại bình thường."),

    h2("7.4 Làm sao để học sinh không nhìn thấy đề thi trước giờ kiểm tra?"),
    bulletItem("•", "Trong quá trình soạn đề, Thầy/Cô hãy để công tắc 'Trạng thái kỳ thi' ở chế độ ĐÓNG (Tắt)."),
    bulletItem("•", "Khi ở chế độ Đóng, học sinh đăng nhập vào sẽ hoàn toàn không nhìn thấy bài thi này."),
    bulletItem("•", "Đúng đến giờ kiểm tra, Thầy/Cô chỉ cần vào danh sách đề thi và bấm BẬT công tắc sang MỞ. Ngay lập tức đề thi sẽ xuất hiện trên màn hình của học sinh."),

    new Paragraph({ children: [new PageBreak()] })
  );

  // =========================================================================
  // PHẦN VIII: THÔNG TIN LIÊN HỆ & BẢN QUYỀN
  // =========================================================================
  sectionsChildren.push(
    h1("PHẦN VIII: THÔNG TIN TÁC GIẢ & HỖ TRỢ KỸ THUẬT"),
    p("Hệ thống EduTest Pro 2.0 được nghiên cứu và phát triển bởi Thầy Nguyễn Phi Hùng với mong muốn đóng góp một công cụ hữu ích cho cộng đồng giáo dục Việt Nam."),
    
    calloutBox("THÔNG TIN LIÊN HỆ VÀ HỖ TRỢ CHUYÊN MÔN", [
      "• Tác giả phát triển: Thầy NGUYỄN PHI HÙNG",
      "• Số điện thoại / Zalo tư vấn & hỗ trợ kỹ thuật: 0938.750.424",
      "• Lĩnh vực hỗ trợ: Cài đặt hệ thống, tích hợp AI bóc tách đề, tùy biến giao diện theo thương hiệu trường học, chuyển giao công nghệ cho các tổ chuyên môn.",
      "• Giấy phép: Phần mềm mã nguồn mở phục vụ phi thương mại cho các trường học và thầy cô giáo."
    ], "success"),

    new Paragraph({ spacing: { before: 180, after: 80 } }),
    p("Kính chúc quý Thầy Cô có những trải nghiệm giảng dạy và kiểm tra đánh giá hiệu quả, chúc các em học sinh đạt kết quả cao trong các kỳ thi!", {
      italics: true,
      alignment: AlignmentType.CENTER,
      color: COLOR.PRIMARY,
      size: 24,
      bold: true
    })
  );

  // Tao doi tuong Document
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
                  text: "EduTest Pro 2.0 - Tài liệu Hướng dẫn Sử dụng Chi tiết",
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
