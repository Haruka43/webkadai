const express = require('express');
const app = express();
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('mydata.db');
const fs = require('fs');
const path = require('path');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
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

  // --- 初期データ投入 ---
  // データが空っぽなら、画像付きの商品を一気に入れる
  db.get('SELECT count(*) as count FROM items', (err, row) => {
    if (row.count === 0) {
      const sql = 'INSERT INTO items (name, price, stock, image) VALUES (?, ?, ?, ?)';

      // ここで商品名と画像ファイル名を紐付けています
      db.run(sql, ['コーラ', 150, 5, 'drink_cola_petbottle.png']);
      db.run(sql, ['ジャスミン茶', 120, 5, 'drink_tea_jasmine.png']);
      db.run(sql, ['コーヒー', 130, 5, 'drink_petbottle_coffee.png']);
      db.run(sql, ['桃ジュース', 160, 5, 'momojuice.jpeg']);
      db.run(sql, ['乳酸菌飲料', 140, 5, 'drink_nyuusankin.jpg']);
      db.run(sql, ['ひやしあめ', 110, 5, 'hiyashiame.jpg']);
      db.run(sql, ['お水', 100, 5, 'drink_petbottle_tsumetai.png']);
      db.run(sql, ['ホットティー', 120, 5, 'drink_petbottle_attakai.png']);

      console.log('新しい商品データを投入しました');
    }
  });
});

// ============================================================
// ここから下は変更なし（機能部分）
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
  const imagesDir = path.join(__dirname, 'public', 'images');
  let allImages = [];
  try {
    allImages = fs.readdirSync(imagesDir).filter((f) => /\.(png|jpe?g|gif|webp|svg)$/i.test(f));
  } catch (e) {
    allImages = [];
  }
  console.log('imagesDir:', imagesDir);
  console.log('allImages count:', allImages.length);

  db.all('SELECT * FROM items', (err, rows) => {
    const map = {};
    (rows || []).forEach((r) => {
      map[r.image] = r;
    });

    const itemsList = allImages.map((img) => {
      if (map[img]) return map[img];
      const name = img.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ');
      return {
        id: null,
        name: name,
        price: null,
        stock: 0,
        image: img,
        placeholder: true
      };
    });

    res.render('index', { items: itemsList });
  });
});

// 購入処理
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
      // 売上テーブルに記録
      const now = new Date().toLocaleString('ja-JP');
      db.run('INSERT INTO sales (item_id, sold_at) VALUES (?, ?)', [itemId, now], (err) => {
        // 結果画面を表示
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
