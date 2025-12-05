const express = require('express');
const app = express();
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('mydata.db');

app.set('view engine', 'ejs');
app.use(express.static('public')); // publicフォルダの画像などを使えるようにする
app.use(express.urlencoded({ extended: true })); // フォームのデータを受け取れるようにする

// --- データベースの初期設定（アプリ起動時に実行） ---
db.serialize(() => {
  // 1. 商品テーブル(items)を作成
  db.run(`CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    price INTEGER,
    stock INTEGER,
    image TEXT
  )`);

  // 2. 売上履歴テーブル(sales)を作成
  db.run(`CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER,
    sold_at TEXT
  )`);

  // --- 初期データ投入（テスト用） ---
  // データが空っぽなら、コーラとお茶を入れておく
  db.get('SELECT count(*) as count FROM items', (err, row) => {
    if (row.count === 0) {
      db.run(`INSERT INTO items (name, price, stock, image) VALUES ('コーラ', 150, 5, 'cola.png')`);
      db.run(`INSERT INTO items (name, price, stock, image) VALUES ('お茶', 120, 5, 'tea.png')`);
      console.log('初期データを投入しました');
    }
  });
});

// ============================================================
// ここから下をチームで分担して記述します
// ============================================================

// --- 【Bさん担当エリア】（商品管理） ---
// 商品一覧・在庫管理画面を表示
app.get('/admin', (req, res) => {
  db.all('SELECT * FROM items', (err, rows) => {
    // views/admin.ejs を作成して、rows（商品データ）を渡す
    res.render('admin', { items: rows });
  });
});

// 在庫を補充する処理など
app.post('/admin/restock/:id', (req, res) => {
  // ここに在庫を増やすUpdate文を書く
  // 処理が終わったら res.redirect("/admin");
});

// --- 【Aさん担当エリア】（購入画面） ---
// 自販機の表側（ユーザー画面）
app.get('/', (req, res) => {
  db.all('SELECT * FROM items', (err, rows) => {
    // views/index.ejs を作成して、rowsを渡す
    // 在庫が0のものは赤くするなどの表示処理はEJS側でやる
    res.render('index', { items: rows });
  });
});

// 購入処理（一番難しいところ！）
app.post('/purchase/:id', (req, res) => {
  const itemId = req.params.id;
  const inputMoney = req.body.money; // フォームから送られた投入金額

  // 1. DBからその商品の価格と在庫を取得
  // 2. 「投入金額 >= 価格」かつ「在庫 > 0」かチェック
  // 3. OKなら在庫を減らす (UPDATE items ...)
  // 4. 売上テーブルに記録 (INSERT INTO sales ...) ← Cさんと連携
  // 5. お釣りを計算して結果画面へ
});

// --- 【Cさん担当エリア】（売上管理） ---
// 売上履歴の表示
app.get('/sales', (req, res) => {
  // salesテーブルとitemsテーブルを結合(JOIN)して取得するとベスト
  db.all(
    `
    SELECT sales.sold_at, items.name, items.price 
    FROM sales 
    JOIN items ON sales.item_id = items.id
    ORDER BY sales.sold_at DESC
  `,
    (err, rows) => {
      // views/sales.ejs を作成して表示
      res.render('sales', { sales: rows });
    }
  );
});

// --- サーバー起動 ---
app.listen(8080, () => console.log('Server running on port 8080'));
