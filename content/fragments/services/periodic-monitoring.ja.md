---
id: periodic-monitoring
language: ja
title: DNS・メール監視（Periodic）
category: services
type: service-description
version: 2025-01
status: production
tags:
  - "dns"
  - "email"
  - "monitoring"
  - "spf"
  - "dkim"
  - "dmarc"
  - "periodic"
sensitivity: normal
author: rick.cogley@esolia.co.jp
created: 2025-12-27
modified: 2025-12-27
review_due: 2026-03-27
allowed_collections:
  - "proposals"
  - "help"
  - "concepts"
---

当社のPeriodicサービスは、貴社ドメインのDNS設定の変動やメール認証の
問題を継続的に監視します。SPF、DKIM、DMARCレコードが予期せず変更された
場合にアラートを受け取ることができ、メールの到達性やセキュリティに
影響が出る前に設定ミスを検出します。

**監視内容:**
- DNSレコードの変更（A、MX、TXT、CNAME）
- SPFレコードの有効性とアライメント
- DKIMキーの存在とローテーション追跡
- DMARCポリシーのコンプライアンス
- DNSSECステータス
- 証明書の透明性ログ
