# SEO Report App (GSC / Looker CSV)

App tạo báo cáo SEO theo tuần, tháng, 3 tháng, 6 tháng với HTML visualization và insight:

- Tháng này viết bao nhiêu bài, chủ đề gì, URL nào
- Performance SEO 3 tháng gần nhất
- Trending up/down content trong 30 ngày (theo logic gần giống GSC Insights)
- URL có dấu hiệu tăng/giảm trong 6 tháng
- URL tăng/giảm nhanh nhất và nhiều nhất

## 1) Cài đặt

```bash
npm install
```

## 2) Chạy Web App (OAuth + Chọn Domain)

```bash
npm start
```

Mở: `http://localhost:3000`

Luồng mặc định cho GSC:

1. Bấm `Authenticate Google`
2. Hoàn tất OAuth
3. Chọn `GSC Property` từ danh sách domain/property có quyền
4. Generate report

Form web hỗ trợ 2 nguồn:

- `Looker CSV`: dùng file export từ Looker Studio/GSC
- `GSC API (OAuth)`: gọi Search Console API theo user login, hỗ trợ nhiều domain

## 3) Chạy CLI (xuất file HTML)

Ví dụ với Looker CSV:

```bash
npm run generate -- --source looker --lookerCsvPath samples/gsc-looker-sample.csv --contentCsvPath samples/content-sample.csv
```

Ví dụ với GSC API:

```bash
npm run generate -- --source gsc --siteUrl sc-domain:example.com --startDate 2026-01-01 --endDate 2026-05-27 --keyFile C:\keys\gsc-service-account.json
```

Output mặc định ở thư mục `output/`.

## 4) Chuẩn bị dữ liệu

### 4.1 Looker CSV (bắt buộc nếu source=looker)

Header linh hoạt, khuyến nghị:

```csv
Date,Page,Clicks,Impressions,CTR,Position
```

App cũng nhận nhiều alias cột như `url`, `landing page`, `url clicks`, `avg position`, ...

### 4.2 Content Metadata CSV (khuyến nghị)

Để tạo insight “tháng này viết bao nhiêu bài, chủ đề gì, URL”:

```csv
url,title,topic,published_date
```

Nếu không truyền file này, app vẫn tạo report SEO performance nhưng phần publishing sẽ trống.

## 5) Cấu hình OAuth + GSC API

Thiết lập khuyến nghị:

1. Tạo OAuth Client ID loại `Web application` trên Google Cloud.
2. Thêm Authorized redirect URI, ví dụ: `http://localhost:3000/auth/callback`
3. Khai báo `.env`:

```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SESSION_SECRET=...
```

Ghi chú:

- `GOOGLE_APPLICATION_CREDENTIALS` vẫn được giữ làm fallback service-account.
- Với yêu cầu nhiều domain và phân quyền theo user, nên dùng OAuth flow.

## 6) API/Logic chính

- `src/datasources/gscApi.js`: kéo dữ liệu từ Search Analytics API (`date`, `page`, `clicks`, `impressions`, `ctr`, `position`)
- `src/lib/csv.js`: parse + normalize Looker CSV & content CSV
- `src/analytics.js`: tính toàn bộ insight tuần/tháng/3 tháng/6 tháng, trending 30d, movers 6m
- `src/renderHtmlReport.js`: render dashboard HTML + chart
- `src/server.js`: UI web
- `src/cli.js`: chạy batch bằng command line

## 7) Dữ liệu mẫu

- `samples/gsc-looker-sample.csv`
- `samples/content-sample.csv`

Bạn có thể chạy ngay để xem report mẫu.

## 8) Tài liệu tham khảo

- Search Analytics query API: [developers.google.com/webmaster-tools/v1/searchanalytics/query](https://developers.google.com/webmaster-tools/v1/searchanalytics/query)
- Search Analytics how-to & paging (`rowLimit`, `startRow`): [developers.google.com/webmaster-tools/v1/how-tos/search_analytics](https://developers.google.com/webmaster-tools/v1/how-tos/search_analytics)
