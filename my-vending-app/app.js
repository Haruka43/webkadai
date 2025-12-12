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
app.get('/admin', (req, res) => {
  db.all('SELECT * FROM items', (err, rows) => {
    res.render('admin', { items: rows });
  });
});

app.post('/admin/restock/:id', (req, res) => {
  const itemId = req.params.id;
  db.run('UPDATE items SET stock = stock + 10 WHERE id = ?', [itemId], (err) => {
    res.redirect('/admin');
  });
});

// --- 【Aさん担当エリア】（購入画面） ---
app.get('/', (req, res) => {
  db.all('SELECT * FROM items', (err, rows) => {
    res.render('index', { items: rows });
  });
});

// ★修正ポイント：購入処理★
app.post('/purchase/:id', (req, res) => {
  const itemId = req.params.id;
  const inputMoney = parseInt(req.body.money);

  // 1. DBからその商品の価格と在庫を取得
  db.get('SELECT * FROM items WHERE id = ?', [itemId], (err, item) => {
    if (err || !item) {
      return res.send('エラー：商品が見つかりません');
    }

    // 2. 判定ロジック
    if (item.stock <= 0) {
      return res.send('エラー：売り切れです！');
    }
    if (inputMoney < item.price) {
      return res.send(`お金が足りません（価格: ${item.price}円 / 投入: ${inputMoney}円）`);
    }

    // 3. 購入成功の処理
    const change = inputMoney - item.price; // お釣り

    // 在庫を1減らす
    db.run('UPDATE items SET stock = stock - 1 WHERE id = ?', [itemId], (err) => {
      // 売上テーブルに記録 (Cさんと連携)
      const now = new Date().toLocaleString('ja-JP');
      db.run('INSERT INTO sales (item_id, sold_at) VALUES (?, ?)', [itemId, now], (err) => {
        // ★ここが変わりました！ result.ejs を表示します
        res.render('result', { item: item, change: change });
      });
    });
  });
});

// --- 【Cさん担当エリア】（売上管理） ---
app.get('/sales', (req, res) => {
  db.all(
    `
    SELECT sales.sold_at, items.name, items.price 
    FROM sales 
    JOIN items ON sales.item_id = items.id
    ORDER BY sales.sold_at DESC
  `,
    (err, rows) => {
      res.render('sales', { sales: rows });
    }
  );
});

// --- サーバー起動 ---
app.listen(8080, () => console.log('Server running on port 8080'));
