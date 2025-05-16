// server.js

const express = require('express');
const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');
const XLSX    = require('xlsx');

const app = express();
const PORT = process.env.PORT || 3000;

// ── 1) 정적(docs/) 디렉터리 서빙
app.use(express.static(path.join(__dirname, 'docs')));

// ── 2) JSON 바디 파싱
app.use(express.json());

// ── 3) Question_List.xlsx 읽어서 질문 배열로 변환 (기존 코드) :contentReference[oaicite:2]{index=2}:contentReference[oaicite:3]{index=3}
const questionWorkbook = XLSX.readFile(path.join(__dirname, 'Question_List.xlsx'));
const questionSheet    = questionWorkbook.Sheets[questionWorkbook.SheetNames[0]];
const questionRows     = XLSX.utils.sheet_to_json(questionSheet, { header: 1 });
const questions        = questionRows.slice(1).map(r => r[0]);

// ── 4) 질문 목록 API
app.get('/api/questions', (req, res) => {
  res.json({ questions });
});

// ── 5) 설문 제출 → 엑셀 생성 → 저장 → URL 반환 (기존 코드) :contentReference[oaicite:4]{index=4}:contentReference[oaicite:5]{index=5}
app.post('/api/submit', (req, res) => {
  const {
    name, school, gender,
    region, subregion, middle, msFlag,
    bcount, schooltype,
    answers
  } = req.body;

  const LABELS = {5:'매우 그렇다',4:'약간 그렇다',3:'보통',2:'약간 아니다',1:'매우 아니다'};

  // 엑셀에 쓸 2차원 배열(data)
  const data = [
    ['학생 성명',      name],
    ['출신 학교',      school],
    ['성별',           gender],
    ['거주 지역',      region],
    ['서울 세부 권역',  subregion],
    ['출신 중학교',    middle],
    ['중학교 플래그',   msFlag],
    ['B등급 과목 수',  bcount],
    ['희망 고교 분류',  schooltype],
    [],
    ['문항 번호','문항','점수','설명']
  ];
  questions.forEach((q, i) => {
    const ans = answers[i];
    data.push([ i+1, q, ans, LABELS[ans] || '' ]);
  });

  // 워크북/시트 생성
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Responses');

  // docs/responses 폴더 보장
  const respDir = path.join(__dirname, 'docs', 'responses');
  if (!fs.existsSync(respDir)) fs.mkdirSync(respDir, { recursive: true });

  // 파일 저장
  const fname = `response_${Date.now()}.xlsx`;
  const outPath = path.join(respDir, fname);
  XLSX.writeFile(wb, outPath);

  // 외부 접근 URL 반환
  const fileUrl = `${req.protocol}://${req.get('host')}/responses/${fname}`;
  res.json({ fileUrl });
});

// ── 6) 업로드용 디렉터리 생성 & Multer 설정
const uploadDir = path.join(__dirname, 'docs', 'files');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext      = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    cb(null, `${basename}_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

// ── 7) Blob 파일 업로드 엔드포인트
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '파일이 업로드되지 않았습니다.' });
  }
  // 업로드된 파일의 외부 URL
  const fileUrl = `${req.protocol}://${req.get('host')}/files/${req.file.filename}`;
  res.json({ url: fileUrl });
});

// ── 8) 서버 시작
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
