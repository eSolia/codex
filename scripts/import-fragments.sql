-- Auto-generated fragment import
-- Generated: 2026-01-09T22:53:08.661Z

-- Clear existing fragments (optional - comment out to preserve)
-- DELETE FROM fragments;

INSERT OR REPLACE INTO fragments (id, site_id, name, slug, category, content_en, content_ja, description, tags, version, status, is_bilingual, default_locale, available_locales)
VALUES (
  'esolia-contact',
  NULL,
  'eSolia Contact Information',
  'esolia-contact',
  'boilerplate',
  '**eSolia Inc.**
Shiodome City Center 5F (Work Styling)
1-5-2 Higashi-Shimbashi, Minato-ku
Tokyo 105-7105, Japan

**Tel:** +81-3-4577-3380
**Web:** https://esolia.co.jp/en
**Email:** hello@esolia.co.jp
',
  '**株式会社イソリア**
〒105-7105　東京都港区東新橋一丁目５番２号
汐留シティセンター５階（Work Styling）

**Tel (代表):** +81-3-4577-3380
**Web:** https://esolia.co.jp
**Email:** hello@esolia.co.jp
',
  '',
  '["contact","esolia","company-info"]',
  '1.0',
  'active',
  1,
  'en',
  '["en", "ja"]'
);

INSERT OR REPLACE INTO fragments (id, site_id, name, slug, category, content_en, content_ja, description, tags, version, status, is_bilingual, default_locale, available_locales)
VALUES (
  'continuous-monitoring',
  NULL,
  'Continuous Security Monitoring',
  'continuous-monitoring',
  'capabilities',
  '## Proactive Security Monitoring

Stay ahead of threats with continuous monitoring that detects issues before they become incidents:

**Real-time Threat Detection**
- 24/7 monitoring of your infrastructure
- Automated anomaly detection
- Correlation of events across systems
- Immediate alerting on suspicious activity

**Vulnerability Management**
- Regular security scans
- Prioritized remediation recommendations
- Tracking of patch status
- Third-party component monitoring

**Compliance Tracking**
- Continuous control assessment
- Evidence collection for audits
- Gap analysis and remediation planning
- Regular compliance reporting

**Security Dashboards**
- Executive-level security posture overview
- Trend analysis and historical data
- Risk scoring and prioritization
- Exportable reports for stakeholders

**Incident Response**
- Defined escalation procedures
- Rapid containment capabilities
- Post-incident analysis and reporting
- Lessons learned integration

All monitoring is managed by eSolia''s security team, with regular reviews and recommendations for improvement.
',
  '## プロアクティブなセキュリティ監視

インシデントになる前に問題を検出する継続的な監視で脅威に先手を打ちます：

**リアルタイム脅威検出**
- インフラストラクチャの24時間365日監視
- 自動異常検出
- システム間でのイベント相関分析
- 疑わしい活動の即時アラート

**脆弱性管理**
- 定期的なセキュリティスキャン
- 優先順位付けされた修正推奨事項
- パッチ状況の追跡
- サードパーティコンポーネントの監視

**コンプライアンス追跡**
- 継続的なコントロール評価
- 監査のための証拠収集
- ギャップ分析と修正計画
- 定期的なコンプライアンスレポート

**セキュリティダッシュボード**
- エグゼクティブレベルのセキュリティ態勢概要
- トレンド分析と履歴データ
- リスクスコアリングと優先順位付け
- ステークホルダー向けのエクスポート可能なレポート

**インシデント対応**
- 定義されたエスカレーション手順
- 迅速な封じ込め能力
- インシデント後の分析とレポート
- 教訓のフィードバック統合

すべての監視はeSOLIAのセキュリティチームが管理し、定期的なレビューと改善提案を提供します。
',
  '',
  '["security","monitoring","compliance"]',
  '1.0',
  'active',
  1,
  'en',
  '["en", "ja"]'
);

INSERT OR REPLACE INTO fragments (id, site_id, name, slug, category, content_en, content_ja, description, tags, version, status, is_bilingual, default_locale, available_locales)
VALUES (
  'dns-email-reliability',
  NULL,
  'DNS & Email Reliability Monitoring',
  'dns-email-reliability',
  'capabilities',
  '## Proactive DNS & Email Monitoring

Ensure your domain and email infrastructure remains healthy and secure with continuous monitoring:

**DNS Health Monitoring**
- Record propagation verification
- DNSSEC validation status
- Nameserver availability checks
- TTL and configuration tracking
- Change detection and alerting

**Email Authentication**
- SPF record validation and monitoring
- DKIM signature verification
- DMARC policy compliance tracking
- Aggregate and forensic report analysis
- Unauthorized sender detection

**Email Deliverability**
- Blacklist monitoring across major providers
- Reputation score tracking
- Bounce rate analysis
- Spam filter testing
- Delivery success metrics

**SSL/TLS Certificate Monitoring**
- Expiration tracking and alerts
- Certificate chain validation
- Protocol version monitoring
- Cipher suite assessment

**Reporting & Alerts**
- Daily health summaries
- Immediate alerts on critical issues
- Trend analysis over time
- Actionable remediation guidance

All monitoring runs continuously with immediate notification when issues are detected, allowing rapid response before impact to your business.
',
  '## プロアクティブなDNS＆メール監視

継続的な監視でドメインとメールインフラストラクチャの健全性とセキュリティを確保します：

**DNSヘルス監視**
- レコード伝播の検証
- DNSSEC検証ステータス
- ネームサーバー可用性チェック
- TTLと設定の追跡
- 変更検出とアラート

**メール認証**
- SPFレコードの検証と監視
- DKIM署名の検証
- DMARCポリシー準拠の追跡
- 集計レポートとフォレンジックレポートの分析
- 不正な送信者の検出

**メール到達性**
- 主要プロバイダー全体でのブラックリスト監視
- 評価スコアの追跡
- バウンス率の分析
- スパムフィルターテスト
- 配信成功メトリクス

**SSL/TLS証明書監視**
- 有効期限の追跡とアラート
- 証明書チェーンの検証
- プロトコルバージョンの監視
- 暗号スイートの評価

**レポート＆アラート**
- 日次ヘルスサマリー
- 重大な問題に対する即時アラート
- 時間経過に伴うトレンド分析
- 実行可能な修正ガイダンス

すべての監視は継続的に実行され、問題が検出されると即座に通知されるため、ビジネスへの影響が出る前に迅速な対応が可能です。
',
  '',
  '["dns","email","monitoring","deliverability"]',
  '1.0',
  'active',
  1,
  'en',
  '["en", "ja"]'
);

INSERT OR REPLACE INTO fragments (id, site_id, name, slug, category, content_en, content_ja, description, tags, version, status, is_bilingual, default_locale, available_locales)
VALUES (
  'infrastructure-management',
  NULL,
  'Managed IT Infrastructure',
  'infrastructure-management',
  'capabilities',
  '## Fully Managed Infrastructure

Focus on your business while we handle the complexity of modern IT infrastructure:

**Cloud Management**
- Multi-cloud expertise and optimization
- Cost monitoring and right-sizing
- Resource provisioning and scaling
- Backup and disaster recovery

**Identity & Access Management**
- Single sign-on implementation
- Multi-factor authentication
- Role-based access control
- Regular access reviews

**Network Security**
- Firewall management
- VPN configuration and support
- Network segmentation
- Traffic monitoring and analysis

**Endpoint Management**
- Device enrollment and configuration
- Security policy enforcement
- Patch management
- Remote wipe capabilities

**Documentation & Knowledge**
- Complete infrastructure documentation
- Runbooks for common procedures
- Change management tracking
- Knowledge transfer to your team

eSolia provides transparent reporting on all managed infrastructure, with regular reviews to ensure alignment with your business needs.
',
  '## 完全マネージドインフラストラクチャ

モダンITインフラストラクチャの複雑さを私たちが処理する間、ビジネスに集中してください：

**クラウド管理**
- マルチクラウドの専門知識と最適化
- コスト監視と適正化
- リソースのプロビジョニングとスケーリング
- バックアップと災害復旧

**アイデンティティ＆アクセス管理**
- シングルサインオンの実装
- 多要素認証
- ロールベースのアクセス制御
- 定期的なアクセスレビュー

**ネットワークセキュリティ**
- ファイアウォール管理
- VPN設定とサポート
- ネットワークセグメンテーション
- トラフィック監視と分析

**エンドポイント管理**
- デバイス登録と設定
- セキュリティポリシーの適用
- パッチ管理
- リモートワイプ機能

**ドキュメンテーション＆ナレッジ**
- 完全なインフラストラクチャドキュメント
- 一般的な手順のランブック
- 変更管理の追跡
- チームへのナレッジ移転

eSOLIAはすべてのマネージドインフラストラクチャについて透明性のあるレポートを提供し、ビジネスニーズとの整合性を確保するための定期的なレビューを実施します。
',
  '',
  '["infrastructure","management","cloud"]',
  '1.0',
  'active',
  1,
  'en',
  '["en", "ja"]'
);

INSERT OR REPLACE INTO fragments (id, site_id, name, slug, category, content_en, content_ja, description, tags, version, status, is_bilingual, default_locale, available_locales)
VALUES (
  'modern-web-development',
  NULL,
  'Modern Web Development',
  'modern-web-development',
  'capabilities',
  '## Modern, Performant Web Applications

We build websites and web applications using current best practices that prioritize speed, security, and maintainability:

**Performance First**
- Server-side rendering for instant initial page loads
- Optimized asset delivery and caching
- Core Web Vitals scores in the "Good" range
- Progressive loading for large content

**Search Engine Optimization**
- Semantic HTML structure
- Proper meta tags and structured data
- Fast load times (a key ranking factor)
- Mobile-first responsive design

**Accessibility**
- WCAG 2.1 AA compliance
- Keyboard navigation support
- Screen reader compatibility
- High contrast and readable typography

**Content Management**
- Easy-to-use editing interface for your team
- Real-time preview of changes
- Version history and rollback capability
- Multi-language content support

**Long-term Maintainability**
- Clean, documented codebase
- Automated testing and deployment
- Regular security updates
- No vendor lock-in

All development follows security best practices, with code review and testing as standard parts of our process.
',
  '## モダンで高性能なWebアプリケーション

私たちは、スピード、セキュリティ、保守性を優先した現在のベストプラクティスを使用してウェブサイトとウェブアプリケーションを構築します：

**パフォーマンス重視**
- 瞬時の初期ページ読み込みのためのサーバーサイドレンダリング
- 最適化されたアセット配信とキャッシング
- 「良好」範囲のCore Web Vitalsスコア
- 大容量コンテンツの段階的読み込み

**検索エンジン最適化**
- セマンティックなHTML構造
- 適切なメタタグと構造化データ
- 高速な読み込み時間（重要なランキング要素）
- モバイルファーストのレスポンシブデザイン

**アクセシビリティ**
- WCAG 2.1 AA準拠
- キーボードナビゲーションサポート
- スクリーンリーダー互換性
- 高コントラストで読みやすいタイポグラフィ

**コンテンツ管理**
- チーム向けの使いやすい編集インターフェース
- 変更のリアルタイムプレビュー
- バージョン履歴とロールバック機能
- 多言語コンテンツサポート

**長期的な保守性**
- クリーンでドキュメント化されたコードベース
- 自動テストとデプロイメント
- 定期的なセキュリティアップデート
- ベンダーロックインなし

すべての開発はセキュリティのベストプラクティスに従い、コードレビューとテストをプロセスの標準部分として実施します。
',
  '',
  '["web","development","frontend"]',
  '1.0',
  'active',
  1,
  'en',
  '["en", "ja"]'
);

INSERT OR REPLACE INTO fragments (id, site_id, name, slug, category, content_en, content_ja, description, tags, version, status, is_bilingual, default_locale, available_locales)
VALUES (
  'secure-hosting',
  NULL,
  'Enterprise-Grade Secure Hosting',
  'secure-hosting',
  'capabilities',
  '## Secure, Globally Distributed Hosting

Your application runs on enterprise-grade infrastructure designed for security, performance, and reliability:

**Global Edge Network**
- Content delivered from data centers worldwide
- Automatic routing to the nearest location
- Sub-100ms response times for most users

**Security by Default**
- DDoS protection at network and application layers
- Web Application Firewall (WAF) with managed rulesets
- Automatic SSL/TLS certificate provisioning and renewal
- Zero Trust security architecture

**Reliability Guarantees**
- 99.99% uptime Service Level Agreement
- Automatic failover and redundancy
- Real-time monitoring and alerting

**Compliance Ready**
- SOC 2 Type II certified infrastructure
- GDPR-compliant data handling
- Regular security audits and penetration testing

All infrastructure is fully managed by eSolia, with 24/7 monitoring and incident response.
',
  '## セキュアでグローバルに分散されたホスティング

お客様のアプリケーションは、セキュリティ、パフォーマンス、信頼性を重視したエンタープライズグレードのインフラストラクチャで稼働します：

**グローバルエッジネットワーク**
- 世界中のデータセンターからコンテンツを配信
- 最寄りのロケーションへの自動ルーティング
- ほとんどのユーザーに対して100ミリ秒未満の応答時間

**デフォルトでセキュア**
- ネットワーク層およびアプリケーション層でのDDoS保護
- マネージドルールセットを備えたWebアプリケーションファイアウォール（WAF）
- SSL/TLS証明書の自動プロビジョニングと更新
- ゼロトラストセキュリティアーキテクチャ

**信頼性の保証**
- 99.99%稼働率のサービスレベル契約
- 自動フェイルオーバーと冗長性
- リアルタイム監視とアラート

**コンプライアンス対応**
- SOC 2 Type II認証インフラストラクチャ
- GDPR準拠のデータ取り扱い
- 定期的なセキュリティ監査とペネトレーションテスト

すべてのインフラストラクチャはeSOLIAが完全に管理し、24時間365日の監視とインシデント対応を提供します。
',
  '',
  '["hosting","security","infrastructure"]',
  '1.0',
  'active',
  1,
  'en',
  '["en", "ja"]'
);

INSERT OR REPLACE INTO fragments (id, site_id, name, slug, category, content_en, content_ja, description, tags, version, status, is_bilingual, default_locale, available_locales)
VALUES (
  'call-to-action',
  NULL,
  'Ready to Start',
  'call-to-action',
  'closing',
  '## Ready to Start?

Let''s discuss how we can help your organization:

- **Schedule a call** — 30-minute introduction call
- **Request a demo** — See our tools and processes in action
- **Get a quote** — Customized pricing for your needs

Contact us today:

- Email: **sales@esolia.co.jp**
- Phone: **03-4577-3380**
- Web: [Book a meeting](https://esolia.co.jp/en/contact)

We respond to all inquiries within one business day.
',
  '## 始める準備はできていますか？

貴社の組織をどのようにサポートできるか、ぜひご相談ください：

- **電話のスケジュール** — 30分の紹介電話
- **デモのリクエスト** — ツールとプロセスを実際にご覧ください
- **見積もりを取得** — ニーズに合わせたカスタマイズ価格

今すぐお問い合わせ：

- メール: **sales@esolia.co.jp**
- 電話: **03-4577-3380**
- Web: [ミーティングを予約](https://esolia.co.jp/contact)

すべてのお問い合わせに1営業日以内に回答いたします。
',
  'Strong call-to-action for proposals.
Use when you want to encourage immediate engagement.
',
  '["closing","cta","engagement"]',
  '2025-01',
  'active',
  1,
  'en',
  '["en", "ja"]'
);

INSERT OR REPLACE INTO fragments (id, site_id, name, slug, category, content_en, content_ja, description, tags, version, status, is_bilingual, default_locale, available_locales)
VALUES (
  'next-steps',
  NULL,
  'Next Steps',
  'next-steps',
  'closing',
  '## Next Steps

1. **Review** — Review this proposal and let us know any questions
2. **Discussion** — Schedule a call to discuss details and adjustments
3. **Agreement** — We prepare the MSA and SoW documents
4. **Signatures** — Both parties sign via DocuSign or similar
5. **Kickoff** — Begin onboarding and service delivery

We are flexible and can adjust scope and terms based on your feedback.

### Timeline

| Phase | Duration |
|-------|----------|
| Review & Discussion | 1-2 weeks |
| Contract Preparation | 3-5 days |
| Kickoff | Upon signature |
',
  '## 次のステップ

1. **レビュー** — 本提案をご確認、ご質問をお知らせください
2. **ディスカッション** — 詳細と調整を話し合う電話を設定
3. **契約書** — MSAとSoW文書を準備
4. **署名** — DocuSign等で両者署名
5. **キックオフ** — オンボーディングとサービス提供開始

スコープと条件はフィードバックに基づいて柔軟に調整可能です。

### タイムライン

| フェーズ | 期間 |
|---------|------|
| レビュー＆ディスカッション | 1〜2週間 |
| 契約書準備 | 3〜5日 |
| キックオフ | 署名後 |
',
  'Standard next steps section for all proposals.
Customize timeline based on engagement complexity.
',
  '["closing","next-steps","workflow","onboarding"]',
  '2025-01',
  'active',
  1,
  'en',
  '["en", "ja"]'
);

INSERT OR REPLACE INTO fragments (id, site_id, name, slug, category, content_en, content_ja, description, tags, version, status, is_bilingual, default_locale, available_locales)
VALUES (
  'standard-closing',
  NULL,
  'In Closing',
  'standard-closing',
  'closing',
  '## In Closing

Thank you for considering our services. We look forward to supporting your needs and building a successful partnership.

Please contact us anytime with questions or to discuss next steps.

---

**Contact Information**

Tel: 03-4577-3380
Email: info@esolia.co.jp
Web: https://esolia.co.jp/en
',
  '## 最後に

当社サービスをご検討いただきありがとうございます。お客様のニーズをサポートし、成功するパートナーシップを築けることを楽しみにしております。

ご質問や次のステップについては、いつでもお気軽にお問い合わせください。

---

**お問い合わせ**

Tel: 03-4577-3380
Email: info@esolia.co.jp
Web: https://esolia.co.jp
',
  'Standard closing for all proposals.
Always include contact information.
',
  '["closing","thank-you","contact"]',
  '2025-01',
  'active',
  1,
  'en',
  '["en", "ja"]'
);

INSERT OR REPLACE INTO fragments (id, site_id, name, slug, category, content_en, content_ja, description, tags, version, status, is_bilingual, default_locale, available_locales)
VALUES (
  'esolia-contact',
  NULL,
  'Contact Information',
  'esolia-contact',
  'company',
  '## Contact Us

**eSolia Inc.**
Shiodome City Center 5F
1-5-2 Higashi-Shimbashi, Minato-ku
Tokyo 105-7105, Japan

| | |
|---|---|
| **Phone** | 03-4577-3380 |
| **Email** | info@esolia.co.jp |
| **Web** | https://esolia.co.jp/en |
| **Hours** | Monday-Friday, 9:00-18:00 JST |

### After Hours Support

For contracted clients with after-hours support coverage, emergency contact details are provided separately.
',
  '## お問い合わせ

**株式会社イソリア**
〒105-7105
東京都港区東新橋1-5-2
汐留シティセンター5階

| | |
|---|---|
| **電話** | 03-4577-3380 |
| **メール** | info@esolia.co.jp |
| **Web** | https://esolia.co.jp |
| **営業時間** | 月〜金、9:00〜18:00 |

### 営業時間外サポート

営業時間外サポート契約をお持ちのお客様には、緊急連絡先を別途ご案内しております。
',
  'Official eSolia contact information.
Updated phone number as of 2025.
',
  '["company","contact","esolia"]',
  '2025-01',
  'active',
  1,
  'en',
  '["en", "ja"]'
);

INSERT OR REPLACE INTO fragments (id, site_id, name, slug, category, content_en, content_ja, description, tags, version, status, is_bilingual, default_locale, available_locales)
VALUES (
  'esolia-overview',
  NULL,
  'About eSolia',
  'esolia-overview',
  'company',
  '## About eSolia

**eSolia Inc.** is a Tokyo-based IT management and consulting firm founded in 1999. We serve as the "virtual IT department" for foreign-affiliated companies operating in Japan.

### At a Glance

| | |
|---|---|
| **Founded** | 1999 |
| **Location** | Shiodome, Tokyo |
| **Team** | Bilingual professionals |
| **Clients** | 50+ active accounts |
| **Focus** | Foreign-affiliated companies in Japan |

### What We Do

- IT infrastructure management
- Help desk and user support
- Cloud and SaaS implementation
- Security and compliance
- Project management

### Why Choose Us

- **Bilingual** — All staff are fluent in Japanese and English
- **Local expertise** — Deep knowledge of doing IT in Japan
- **Vendor neutral** — We recommend what''s best, not what pays us most
- **Responsive** — Fast response times with clear communication
',
  '## イソリアについて

**株式会社イソリア**は、1999年設立の東京を拠点とするIT管理・コンサルティング企業です。日本で事業を展開する外資系企業の「バーチャルIT部門」として機能しています。

### 会社概要

| | |
|---|---|
| **設立** | 1999年 |
| **所在地** | 東京・汐留 |
| **チーム** | バイリンガル専門家 |
| **クライアント** | 50社以上のアクティブアカウント |
| **対象** | 日本の外資系企業 |

### 事業内容

- ITインフラ管理
- ヘルプデスクとユーザーサポート
- クラウド・SaaS導入
- セキュリティとコンプライアンス
- プロジェクト管理

### 選ばれる理由

- **バイリンガル** — 全スタッフが日本語と英語に堪能
- **現地の専門知識** — 日本でのIT運用に関する深い知識
- **ベンダー中立** — 最も報酬の高いものではなく、最適なものを推奨
- **迅速な対応** — 明確なコミュニケーションと素早い対応
',
  'Standard company overview.
Use in proposals and introductory materials.
',
  '["company","about","esolia","overview"]',
  '2025-01',
  'active',
  1,
  'en',
  '["en", "ja"]'
);

INSERT OR REPLACE INTO fragments (id, site_id, name, slug, category, content_en, content_ja, description, tags, version, status, is_bilingual, default_locale, available_locales)
VALUES (
  'cloudflare-security-layers',
  NULL,
  'Cloudflare Security Architecture',
  'cloudflare-security-layers',
  'diagrams',
  'Every device connects through Cloudflare''s network. Malicious sites are
blocked before they load. Your website is protected from attacks. Your
team works securely from anywhere—home, serviced office, or a hotel or café.
',
  'すべてのデバイスがCloudflareのネットワークを経由して接続されます。悪意の
あるサイトは読み込まれる前にブロックされます。貴社のウェブサイトは攻撃
から保護されます。チームはどこからでも安全に作業できます—自宅、サービス
オフィス、ホテルやカフェからでも。
',
  '',
  '["cloudflare","security","architecture","zero-trust","network"]',
  '1.0',
  'active',
  1,
  'en',
  '["en", "ja"]'
);

INSERT OR REPLACE INTO fragments (id, site_id, name, slug, category, content_en, content_ja, description, tags, version, status, is_bilingual, default_locale, available_locales)
VALUES (
  'cloudflare-three-layers',
  NULL,
  'Three Layers of Cloudflare Protection',
  'cloudflare-three-layers',
  'diagrams',
  'Cloudflare provides three integrated security layers: DNS filtering to
block threats before they reach your network, web application protection
for your online presence, and encrypted tunnels for secure remote access.
',
  'Cloudflareは3つの統合されたセキュリティレイヤーを提供します：ネットワーク
に到達する前に脅威をブロックするDNSフィルタリング、オンラインプレゼンス
のためのWebアプリケーション保護、安全なリモートアクセスのための暗号化
トンネル。
',
  '',
  '["cloudflare","security","dns","waf","zero-trust"]',
  '1.0',
  'active',
  1,
  'en',
  '["en", "ja"]'
);

INSERT OR REPLACE INTO fragments (id, site_id, name, slug, category, content_en, content_ja, description, tags, version, status, is_bilingual, default_locale, available_locales)
VALUES (
  'esolia-cloudflare-m365-smb-security-coverage-ja',
  NULL,
  'Esolia Cloudflare M365 Smb Security Coverage Ja',
  'esolia-cloudflare-m365-smb-security-coverage-ja',
  'diagrams',
  '![Esolia Cloudflare M365 Smb Security Coverage Ja](/api/diagrams/esolia-cloudflare-m365-smb-security-coverage-ja)

Diagram: Esolia Cloudflare M365 Smb Security Coverage Ja',
  '![Esolia Cloudflare M365 Smb Security Coverage Ja](/api/diagrams/esolia-cloudflare-m365-smb-security-coverage-ja)

Diagram: Esolia Cloudflare M365 Smb Security Coverage Ja',
  '',
  '["diagram"]',
  '1.0',
  'active',
  1,
  'en',
  '["en", "ja"]'
);

INSERT OR REPLACE INTO fragments (id, site_id, name, slug, category, content_en, content_ja, description, tags, version, status, is_bilingual, default_locale, available_locales)
VALUES (
  'esolia-m365-components-en',
  NULL,
  'Esolia M365 Components En',
  'esolia-m365-components-en',
  'diagrams',
  '![Esolia M365 Components En](/api/diagrams/esolia-m365-components-en)

Diagram: Esolia M365 Components En',
  '![Esolia M365 Components En](/api/diagrams/esolia-m365-components-en)

Diagram: Esolia M365 Components En',
  '',
  '["diagram"]',
  '1.0',
  'active',
  1,
  'en',
  '["en", "ja"]'
);

INSERT OR REPLACE INTO fragments (id, site_id, name, slug, category, content_en, content_ja, description, tags, version, status, is_bilingual, default_locale, available_locales)
VALUES (
  'esolia-m365-components-ja',
  NULL,
  'Esolia M365 Components Ja',
  'esolia-m365-components-ja',
  'diagrams',
  '![Esolia M365 Components Ja](/api/diagrams/esolia-m365-components-ja)

Diagram: Esolia M365 Components Ja',
  '![Esolia M365 Components Ja](/api/diagrams/esolia-m365-components-ja)

Diagram: Esolia M365 Components Ja',
  '',
  '["diagram"]',
  '1.0',
  'active',
  1,
  'en',
  '["en", "ja"]'
);

INSERT OR REPLACE INTO fragments (id, site_id, name, slug, category, content_en, content_ja, description, tags, version, status, is_bilingual, default_locale, available_locales)
VALUES (
  'fiber-path-diagram_1',
  NULL,
  'Fiber Path Diagram 1',
  'fiber-path-diagram_1',
  'diagrams',
  '![Fiber Path Diagram 1](/api/diagrams/fiber-path-diagram_1)

Diagram: Fiber Path Diagram 1',
  '![Fiber Path Diagram 1](/api/diagrams/fiber-path-diagram_1)

Diagram: Fiber Path Diagram 1',
  '',
  '["diagram"]',
  '1.0',
  'active',
  1,
  'en',
  '["en", "ja"]'
);

INSERT OR REPLACE INTO fragments (id, site_id, name, slug, category, content_en, content_ja, description, tags, version, status, is_bilingual, default_locale, available_locales)
VALUES (
  'cloudflare-security-platform',
  NULL,
  'Cloudflare Security Platform',
  'cloudflare-security-platform',
  'products',
  '**Secure DNS:** All internet traffic from company devices routes through
Cloudflare''s network, blocking malicious websites, malware downloads, and
phishing sites before they can cause harm.

**Secure Website:** A professional marketing website hosted on Cloudflare
Pages, protected by their web application firewall and DDoS protection.
Fast, secure, and globally distributed.

**Secure Access:** Every PC and mobile device connects through an encrypted
tunnel, protecting your team whether they''re in the office, at home, or on
client sites—without the complexity or cost of traditional methods.

What this means for you: **enterprise-grade network security without buying
equipment.** No firewall appliances to maintain, no network expertise required.
Your team simply enables "WARP" on their device, and they''re protected. It
works the same whether they''re at their desk or working from a coffee shop.
',
  '**セキュアDNS:** 会社のデバイスからのすべてのインターネットトラフィックが
Cloudflareのネットワークを経由し、悪意のあるウェブサイト、マルウェアの
ダウンロード、フィッシングサイトを被害が発生する前にブロックします。

**セキュアウェブサイト:** Cloudflare Pagesでホストされるプロフェッショナル
なマーケティングウェブサイト。Webアプリケーションファイアウォールと
DDoS保護との組み合わせ。高速、安全、グローバルに分散されています。

**セキュアアクセス:** すべてのPCとモバイルデバイスが暗号化トンネルを経由
して接続され、オフィス、自宅、クライアント先のいずれにいてもチームを
保護します。従来の方法のような複雑さやコストはありません。

これが意味すること：**機器を購入することなくエンタープライズグレードの
ネットワークセキュリティを実現。** 維持管理が必要なファイアウォール機器も、
ネットワークの専門知識も不要です。チームはデバイスで「WARP」を有効にする
だけで保護されます。デスクでもカフェでも同じように機能します。
',
  '',
  '["cloudflare","zero-trust","security","dns","warp","waf"]',
  '1.0',
  'active',
  1,
  'en',
  '["en", "ja"]'
);

INSERT OR REPLACE INTO fragments (id, site_id, name, slug, category, content_en, content_ja, description, tags, version, status, is_bilingual, default_locale, available_locales)
VALUES (
  'm365-business-premium',
  NULL,
  'Microsoft 365 Business Premium',
  'm365-business-premium',
  'products',
  '**Full Office Applications:** The license includes perpetual desktop
versions of Word, Excel, PowerPoint, and Outlook—replacing whatever
came with your laptops with properly licensed, always-updated software.

**Business Email:** Professional email hosting with your company domain,
plus calendars, contacts, and Microsoft Teams for collaboration.

**Defender Protection:** Microsoft Defender is included, providing:

- Antivirus and anti-malware scanning across all devices
- Anti-phishing protection that scans email links and attachments before you open them
- Safe Links that check URLs at the moment you click, blocking newly-discovered threats
- Safe Attachments that open files in a protected sandbox to detect hidden malware
- Device security policies that ensure laptops and phones meet security standards

These Defender features are typically only available in Microsoft''s expensive
enterprise licenses. Business Premium includes them at a mid-tier price.
',
  '**フルOfficeアプリケーション:** このライセンスには、Word、Excel、
PowerPoint、Outlookの永続デスクトップ版が含まれています。ノートPCに
プリインストールされていたアプリケーションを、正規ライセンスの常に
最新のソフトウェアに置き換えます。

**ビジネスメール:** 貴社ドメインでのプロフェッショナルなメール
ホスティング、カレンダー、連絡先、Microsoft Teamsによるコラボ
レーション機能を提供します。

**Defender保護:** Microsoft Defenderが含まれており、以下の機能を
提供します：

- すべてのデバイスでのウイルス対策・マルウェア対策スキャン
- メールのリンクや添付ファイルを開く前にスキャンするフィッシング対策
- クリック時にURLをチェックし、新たに発見された脅威をブロックするSafe Links
- 隠れたマルウェアを検出するため、保護されたサンドボックスでファイルを開くSafe Attachments
- ノートPCやスマートフォンがセキュリティ基準を満たしていることを確認するデバイスセキュリティポリシー

これらのDefender機能は、通常Microsoftの高価なエンタープライズライセンス
でのみ利用可能です。Business Premiumでは、中間価格帯でこれらを利用できます。
',
  '',
  '["m365","licensing","productivity","security","defender","intune"]',
  '1.0',
  'active',
  1,
  'en',
  '["en", "ja"]'
);

INSERT OR REPLACE INTO fragments (id, site_id, name, slug, category, content_en, content_ja, description, tags, version, status, is_bilingual, default_locale, available_locales)
VALUES (
  'esolia-agreement-characteristics',
  NULL,
  'Agreement Structure',
  'esolia-agreement-characteristics',
  'proposals',
  '## Agreement Structure

### Contract Format

eSolia uses a **Master Services Agreement (MSA)** and **Statement of Work (SoW)** structure:

- **MSA** — Basic terms covering confidentiality, liability, and general conditions
- **SoW** — Specific scope, services, and pricing for each engagement

### Billing Model

Our agreements are time-and-materials based with transparent pricing:

| Item | Description |
|------|-------------|
| **Minimum billing** | 1 hour minimum per visit |
| **Increments** | 15-minute increments beyond minimum |
| **Administration fee** | Monthly fixed fee for account management |
| **Callout fee** | Per-visit fee for onsite work (Tokyo 23 wards) |

### Rate Options

Greater commitment means better rates:

- **Reserved Hours** — Regular monthly commitment
- **Pool Blocks** — Pre-paid time (12-month validity)
- **Multi-year Term** — Reduced rates for longer commitment
',
  '## ご契約について

### 契約形式

イソリアは**マスターサービス契約（MSA）**と**業務仕様書（SoW）**の構造を採用しています：

- **MSA** — 機密保持、責任、一般条件を規定する基本契約
- **SoW** — 各エンゲージメントの具体的な範囲、サービス、価格

### 請求モデル

タイム＆マテリアル方式で透明性のある価格設定：

| 項目 | 説明 |
|------|------|
| **最低請求** | 訪問ごとに1時間最低 |
| **増分** | 最低時間を超えた分は15分単位 |
| **管理費** | アカウント管理のための月額固定料金 |
| **出張費** | オンサイト作業の訪問ごとの料金（東京23区内） |

### レートオプション

より大きなコミットメントでより良いレート：

- **予約時間** — 月次の定期的なコミットメント
- **プールブロック** — 前払い時間（12ヶ月有効）
- **複数年契約** — 長期コミットメントで割引レート
',
  'Standard terms section for all proposals.
Specific rates in client-specific offer section.
',
  '["proposal","agreement","billing","terms"]',
  '2025-12',
  'active',
  1,
  'en',
  '["en", "ja"]'
);

INSERT OR REPLACE INTO fragments (id, site_id, name, slug, category, content_en, content_ja, description, tags, version, status, is_bilingual, default_locale, available_locales)
VALUES (
  'esolia-background',
  NULL,
  'eSolia Background',
  'esolia-background',
  'proposals',
  '## How We Work

eSolia functions as a **virtual IT department** for our clients. We provide the full range of skills typically found in an internal IT team—from daily support and helpdesk to infrastructure, security, and project management.

### Our Approach

**Quality over quantity** — We focus on delivering real value, not just completing tasks. Our goal is to solve your actual business problems, not just provide generic IT services.

**Team-based coverage** — We never send a single engineer. Your dedicated team has complementary skills covering all typical IT department functions, ensuring continuity and comprehensive support.

**Your problems, our focus** — We work as an extension of your team, following your policies and adapting to your environment while bringing our expertise and experience.

**Clear communication** — With bilingual professionals experienced in both Japanese and Western business cultures, we bridge the gap between headquarters and local operations.

### Areas of Focus

| Area | Description |
|------|-------------|
| **Operations** | Helpdesk, user support, day-to-day IT operations |
| **Infrastructure** | Networks, servers, cloud services, security |
| **Management** | Project management, vendor coordination, budgeting |
| **Governance** | IT strategy, policy, compliance, risk management |

We adjust emphasis across these areas based on your specific requirements.
',
  '## 私たちの働き方

イソリアは、お客様の**バーチャルIT部門**として機能します。日常サポートやヘルプデスクからインフラ、セキュリティ、プロジェクト管理まで、社内ITチームに通常求められるあらゆるスキルを提供します。

### アプローチ

**量より質** — タスクをこなすだけでなく、真の価値を提供することに注力します。一般的なITサービスではなく、お客様の実際のビジネス課題を解決することが目標です。

**チームベースのカバレッジ** — 単独のエンジニアは派遣しません。お客様専任のチームが補完的なスキルを持ち、IT部門の全機能をカバーし、継続性と包括的なサポートを確保します。

**お客様の課題に集中** — お客様のチームの延長として、お客様のポリシーに従い環境に適応しながら、私たちの専門知識と経験を活かします。

**明確なコミュニケーション** — 日本とウェスタンの両方のビジネス文化に精通したバイリンガルプロフェッショナルが、本社と現地拠点の橋渡しをします。

### 注力分野

| 分野 | 説明 |
|------|------|
| **オペレーション** | ヘルプデスク、ユーザーサポート、日常IT運用 |
| **インフラストラクチャ** | ネットワーク、サーバー、クラウドサービス、セキュリティ |
| **マネジメント** | プロジェクト管理、ベンダー調整、予算管理 |
| **ガバナンス** | IT戦略、ポリシー、コンプライアンス、リスク管理 |

お客様の具体的なご要望に応じて、各分野への注力度を調整します。
',
  'Explains eSolia''s team approach and focus areas.
Aligned with 2025 website messaging.
',
  '["proposal","background","approach"]',
  '2025-12',
  'active',
  1,
  'en',
  '["en", "ja"]'
);

INSERT OR REPLACE INTO fragments (id, site_id, name, slug, category, content_en, content_ja, description, tags, version, status, is_bilingual, default_locale, available_locales)
VALUES (
  'esolia-closing',
  NULL,
  'In Closing',
  'esolia-closing',
  'proposals',
  '## Next Steps

1. **Review** — Review this proposal and let us know any questions
2. **Discussion** — Schedule a call to discuss details
3. **Agreement** — We prepare the MSA and SoW documents
4. **Signatures** — Both parties sign
5. **Kickoff** — Begin onboarding

We are flexible and can adjust scope and terms based on your feedback.

## In Closing

Thank you for considering eSolia. We look forward to supporting your IT needs in Japan.

Please contact us anytime with questions.

**eSolia Inc.**

Tel: 03-4577-3380
Email: info@esolia.co.jp
Web: https://esolia.co.jp/en
',
  '## 次のステップ

1. **レビュー** — 本提案をご確認、ご質問をお知らせください
2. **ディスカッション** — 詳細を話し合う電話を設定
3. **契約書** — MSAとSoW文書を準備
4. **署名** — 両者で署名
5. **キックオフ** — オンボーディング開始

スコープと条件はフィードバックに基づいて柔軟に調整可能です。

## 最後に

イソリアをご検討いただきありがとうございます。日本でのITニーズをサポートできることを楽しみにしております。

ご質問があればいつでもお気軽にお問い合わせください。

**株式会社イソリア**

Tel: 03-4577-3380
Email: info@esolia.co.jp
Web: https://esolia.co.jp
',
  'Standard closing for all proposals.
Updated phone number as of 2025.
',
  '["proposal","closing","next-steps"]',
  '2025-12',
  'active',
  1,
  'en',
  '["en", "ja"]'
);

INSERT OR REPLACE INTO fragments (id, site_id, name, slug, category, content_en, content_ja, description, tags, version, status, is_bilingual, default_locale, available_locales)
VALUES (
  'esolia-introduction',
  NULL,
  'eSolia Introduction',
  'esolia-introduction',
  'proposals',
  '## Introduction

eSolia is a Tokyo-based B2B IT professional services firm. Since 1999, we have provided bilingual IT support to international companies operating in Japan, functioning as their local IT department with the same skills and expertise as a dedicated in-house team.

**What sets us apart:**

- **Team-based approach** — We never dispatch single engineers. Our team provides comprehensive coverage across helpdesk, infrastructure, security, and project management.
- **Bilingual professionals** — Native-level English and Japanese communication, bridging headquarters and Japan operations seamlessly.
- **25+ years of experience** — Established operational processes, thorough documentation, and proven track record with multinational clients.
- **Vendor neutral** — We recommend solutions based purely on your needs, not vendor relationships.

We focus on solving your problems, not just providing IT services. Our mission is to deliver practical, durable solutions while maintaining the highest standards of professionalism and confidentiality.

Thank you for the opportunity to present this proposal.

— eSolia Inc.
',
  '## はじめに

イソリアは、東京を拠点とする法人向け（B2B）ITプロフェッショナルサービス企業です。1999年以来、日本で事業を展開する国際企業に対し、バイリンガルITサポートを提供し、専任のIT部門と同等のスキルと専門性を備えたローカルIT部門として機能してまいりました。

**私たちの強み:**

- **チームベースのアプローチ** — 単独のエンジニア派遣は行いません。ヘルプデスク、インフラ、セキュリティ、プロジェクト管理まで、チームで包括的にカバーします。
- **バイリンガルプロフェッショナル** — 英語・日本語ネイティブレベルのコミュニケーションで、本社と日本拠点をシームレスに橋渡しします。
- **25年以上の実績** — 確立された運用プロセス、徹底したドキュメンテーション、多国籍クライアントとの実績があります。
- **ベンダーニュートラル** — ベンダーとの関係ではなく、お客様のニーズに基づいた最適なソリューションをご提案します。

私たちはITサービスを提供するだけでなく、お客様の課題解決に注力します。プロフェッショナリズムと守秘義務の最高基準を維持しながら、実践的で耐久性のあるソリューションをお届けすることが私たちの使命です。

本提案の機会をいただき、誠にありがとうございます。

— 株式会社イソリア
',
  'Standard opening for all eSolia proposals.
Should appear after the cover page and table of contents.
B2B focused messaging aligned with 2025 website content.
',
  '["proposal","introduction","B2B"]',
  '2025-12',
  'active',
  1,
  'en',
  '["en", "ja"]'
);

INSERT OR REPLACE INTO fragments (id, site_id, name, slug, category, content_en, content_ja, description, tags, version, status, is_bilingual, default_locale, available_locales)
VALUES (
  'esolia-profile',
  NULL,
  'eSolia Profile',
  'esolia-profile',
  'proposals',
  '## Company Profile

| | |
|---|---|
| **Company** | eSolia Inc. (株式会社イソリア) |
| **Headquarters** | Shiodome City Center 5F, Tokyo |
| **Established** | July 7, 1999 |
| **Leadership** | James R. Cogley (CEO), Takumi Fukuoka (COO) |
| **Website** | https://esolia.co.jp/en |

### Our Services

- Remote and on-site IT support
- Project management
- IT consulting
- Helpdesk services
- Information security
- Cloud database services (PROdb)
- Web development
- Procurement and asset management

### Certifications & Partners

Our team holds certifications from Microsoft, CompTIA, Fortinet, and ITIL. We partner with industry leaders including Microsoft 365, AWS, Fortinet, HP, and Dell.

For detailed company information, capability statement, and code of conduct, please visit: **https://esolia.co.jp/en/about/**
',
  '## 会社概要

| | |
|---|---|
| **会社名** | 株式会社イソリア (eSolia Inc.) |
| **本社** | 東京都港区 汐留シティセンター5F |
| **設立** | 1999年7月7日 |
| **代表** | コグレー ジェームズ（CEO）、福岡 琢巳（COO） |
| **ウェブサイト** | https://esolia.co.jp |

### サービス内容

- リモートおよびオンサイトITサポート
- プロジェクト管理
- ITコンサルティング
- ヘルプデスクサービス
- 情報セキュリティ
- クラウドデータベースサービス（PROdb）
- ウェブ開発
- 調達および資産管理

### 認証・パートナー

チームメンバーはMicrosoft、CompTIA、Fortinet、ITILなどの認証を保有しています。Microsoft 365、AWS、Fortinet、HP、Dellなどの業界リーダーと提携しています。

会社詳細、能力書、行動規範については、こちらをご覧ください: **https://esolia.co.jp/about/**
',
  'Slim company profile for proposals.
Directs readers to website for full company details.
Update headquarters address if office moves.
',
  '["proposal","profile","company-info"]',
  '2025-12',
  'active',
  1,
  'en',
  '["en", "ja"]'
);

INSERT OR REPLACE INTO fragments (id, site_id, name, slug, category, content_en, content_ja, description, tags, version, status, is_bilingual, default_locale, available_locales)
VALUES (
  'esolia-project-types',
  NULL,
  'eSolia Project Types',
  'esolia-project-types',
  'proposals',
  '## Track Record

Since 1999, we have successfully delivered projects across multiple industries including finance, legal, healthcare, manufacturing, and retail. Our experience spans:

**Office & Facilities**
- Office moves and setup (IT, security, AV)
- Data center construction and optimization
- Building power outage coordination (annual Japan requirement)

**Infrastructure & Security**
- Network design, implementation, upgrades
- Microsoft 365 deployment and management
- VPN and secure remote access
- Security assessments and compliance

**Compliance & Audit**
- SOX IT controls design, testing, documentation
- FDA/PMDA regulatory compliance support
- SSAE audit support for financial services

**Systems & Development**
- Enterprise software projects (ERP, CRM)
- Database development and migration
- Cloud PBX and video conferencing

**Ongoing Support**
- Helpdesk services (Tier 1, 2, 3)
- IT department interim management
- Co-support with client IT teams

For detailed success stories, visit: **https://esolia.co.jp/en/success/**
',
  '## 実績

1999年以来、金融、法律、ヘルスケア、製造、小売など複数の業界でプロジェクトを成功裏に遂行してきました。経験分野は以下の通りです：

**オフィス・施設**
- オフィス移転・セットアップ（IT、セキュリティ、AV）
- データセンター構築・最適化
- ビル停電対応調整（日本の年次法定点検）

**インフラ・セキュリティ**
- ネットワーク設計、導入、アップグレード
- Microsoft 365展開・管理
- VPNおよびセキュアリモートアクセス
- セキュリティ評価とコンプライアンス

**コンプライアンス・監査**
- SOX IT統制の設計、テスト、文書化
- FDA/PMDA規制対応コンプライアンスサポート
- 金融サービス向けSSAE監査サポート

**システム・開発**
- エンタープライズソフトウェアプロジェクト（ERP、CRM）
- データベース開発・移行
- クラウドPBX・ビデオ会議

**継続サポート**
- ヘルプデスクサービス（ティア1、2、3）
- IT部門暫定管理
- クライアントITチームとの共同サポート

詳細な成功事例については、こちらをご覧ください: **https://esolia.co.jp/success/**
',
  'Condensed track record for proposals.
Directs to website for detailed success stories.
',
  '["proposal","projects","experience"]',
  '2025-12',
  'active',
  1,
  'en',
  '["en", "ja"]'
);

INSERT OR REPLACE INTO fragments (id, site_id, name, slug, category, content_en, content_ja, description, tags, version, status, is_bilingual, default_locale, available_locales)
VALUES (
  'esolia-service-mechanics',
  NULL,
  'Service Mechanics',
  'esolia-service-mechanics',
  'proposals',
  '## How We Deliver Support

### Systems & Tools

| System | Purpose |
|--------|---------|
| **Ticket System** | Issue tracking, SLA monitoring, reporting |
| **Microsoft 365** | Collaboration and documentation |
| **Teams/Zoom** | Remote support and meetings |
| **Remote Access** | Secure troubleshooting |
| **Knowledge Base** | Documented procedures |

### Support Hours

| Type | Hours |
|------|-------|
| **Standard** | Weekdays 9:00-18:00 JST |
| **Extended** | Available by arrangement |
| **Emergency** | Best-effort outside business hours |

### Response Targets

| Request Type | Target Response |
|--------------|-----------------|
| **Urgent/Critical** | 1-2 hours |
| **Standard** | Same business day |
| **Scheduled** | Per agreed schedule |

### Communication

- **Monthly Reports** — Activity summary and recommendations
- **Regular Meetings** — Frequency as agreed
- **Clear Escalation** — Defined procedures for urgent issues
',
  '## サポート提供の仕組み

### システム・ツール

| システム | 目的 |
|----------|------|
| **チケットシステム** | 課題追跡、SLAモニタリング、レポート |
| **Microsoft 365** | コラボレーションと文書管理 |
| **Teams/Zoom** | リモートサポートとミーティング |
| **リモートアクセス** | セキュアなトラブルシューティング |
| **ナレッジベース** | 文書化された手順 |

### サポート時間

| 種類 | 時間 |
|------|------|
| **標準** | 平日 9:00-18:00 JST |
| **延長** | 事前調整により対応可能 |
| **緊急** | 営業時間外はベストエフォート |

### 対応目標

| リクエスト種別 | 目標対応時間 |
|----------------|--------------|
| **緊急/重大** | 1-2時間 |
| **標準** | 同営業日内 |
| **スケジュール作業** | 合意したスケジュール |

### コミュニケーション

- **月次レポート** — 活動サマリーと推奨事項
- **定例ミーティング** — 合意した頻度で実施
- **明確なエスカレーション** — 緊急課題への対応手順
',
  'Standard service mechanics section.
Specific SLA terms in client-specific section.
',
  '["proposal","service","support"]',
  '2025-12',
  'active',
  1,
  'en',
  '["en", "ja"]'
);

INSERT OR REPLACE INTO fragments (id, site_id, name, slug, category, content_en, content_ja, description, tags, version, status, is_bilingual, default_locale, available_locales)
VALUES (
  'esolia-support-types',
  NULL,
  'Support Types',
  'esolia-support-types',
  'proposals',
  '## Support Models

We offer two primary support models:

### Comparison

| Feature | TotalSupport | Co-Support |
|---------|--------------|------------|
| **Nature** | Proactive, SLA-based | Request-based, flexible |
| **Rate Structure** | Role-based rates | Blended rate |
| **User Contact** | Direct user support | Via designated contact |
| **Meetings** | 2x per month | 1x per month |
| **Best For** | Full IT coverage | IT team augmentation |

### TotalSupport

Comprehensive IT coverage for organizations without dedicated local IT:

- Regular scheduled support and availability
- Project work at agreed rates
- Vendor coordination and procurement
- User onboarding and training

### Co-Support

Flexible support for organizations with existing IT staff:

- On-demand assistance
- Skill augmentation for gaps
- Project surge capacity
- Knowledge transfer
',
  '## サポートモデル

2つの主要なサポートモデルを提供しています：

### 比較

| 特徴 | TotalSupport | Co-Support |
|------|--------------|------------|
| **性質** | プロアクティブ、SLAベース | リクエストベース、柔軟 |
| **レート体系** | 役割別レート | ブレンドレート |
| **ユーザー対応** | 直接ユーザーサポート | 指定連絡先経由 |
| **ミーティング** | 月2回 | 月1回 |
| **最適な用途** | フルITカバレッジ | ITチーム補強 |

### TotalSupport

専任ローカルITがない組織向けの包括的ITカバレッジ：

- 定期的なスケジュールサポートと対応
- 合意レートでのプロジェクト作業
- ベンダー調整と調達
- ユーザーオンボーディングとトレーニング

### Co-Support

既存ITスタッフがいる組織向けの柔軟なサポート：

- オンデマンド支援
- ギャップを埋めるスキル補完
- プロジェクト増員キャパシティ
- ナレッジトランスファー
',
  'Use when explaining support model options.
',
  '["proposal","support","totalsupport","co-support"]',
  '2025-12',
  'active',
  1,
  'en',
  '["en", "ja"]'
);

INSERT OR REPLACE INTO fragments (id, site_id, name, slug, category, content_en, content_ja, description, tags, version, status, is_bilingual, default_locale, available_locales)
VALUES (
  'ongoing-support',
  NULL,
  'Ongoing IT Support Services',
  'ongoing-support',
  'services',
  '## eSolia IT Support Services

Reliable, professional IT support tailored to your organization''s needs:

**TotalSupport** — Comprehensive Managed IT

Your virtual IT department. We handle all aspects of your IT operations:
- Help desk for end-user support
- System administration and maintenance
- Vendor management and coordination
- Project planning and execution
- Strategic IT consulting
- Regular reporting and reviews

Ideal for organizations that want to outsource IT operations entirely.

**Co-Support** — Collaborative Partnership

Work alongside your existing IT team:
- Augment your team''s capabilities
- Provide specialized expertise
- Handle overflow and after-hours support
- Knowledge transfer and training
- Backup for vacations and absences

Ideal for organizations with internal IT that need additional capacity or expertise.

**Support Delivery**
- Bilingual support (English and Japanese)
- Business hours and after-hours options available
- Remote and on-site support
- Ticketing system with full history
- SLA-backed response times

eSolia''s support team brings decades of combined experience supporting businesses in Japan, with deep knowledge of both local and international IT environments.
',
  '## eSOLIA ITサポートサービス

お客様の組織のニーズに合わせた信頼性の高いプロフェッショナルなITサポート：

**TotalSupport** — 包括的マネージドIT

お客様のバーチャルIT部門として、IT運用のすべての側面を担当します：
- エンドユーザーサポートのヘルプデスク
- システム管理とメンテナンス
- ベンダー管理と調整
- プロジェクト計画と実行
- 戦略的ITコンサルティング
- 定期的なレポートとレビュー

IT運用を完全にアウトソーシングしたい組織に最適です。

**Co-Support** — コラボレーティブパートナーシップ

既存のITチームと協力して：
- チームの能力を強化
- 専門的な知識を提供
- オーバーフローと時間外サポートを処理
- ナレッジ移転とトレーニング
- 休暇や不在時のバックアップ

追加のキャパシティや専門知識が必要な社内ITを持つ組織に最適です。

**サポート提供方法**
- バイリンガルサポート（英語と日本語）
- 営業時間および時間外オプションあり
- リモートおよびオンサイトサポート
- 完全な履歴を持つチケットシステム
- SLAに基づく応答時間

eSOLIAのサポートチームは、日本でのビジネスサポートにおける数十年の経験を持ち、国内外のIT環境に関する深い知識を持っています。
',
  '',
  '["support","helpdesk","managed-services"]',
  '1.0',
  'active',
  1,
  'en',
  '["en", "ja"]'
);

INSERT OR REPLACE INTO fragments (id, site_id, name, slug, category, content_en, content_ja, description, tags, version, status, is_bilingual, default_locale, available_locales)
VALUES (
  'password-manager',
  NULL,
  'Password Manager Recommendation',
  'password-manager',
  'services',
  'We recommend implementing a team password manager (1Password or Bitwarden)
to eliminate password reuse and enable secure credential sharing. This is
one of the highest-impact security improvements any small team can make.

**Key Benefits:**
- Unique, strong passwords for every service
- Secure sharing of credentials among team members
- Protection against phishing (autofill only works on legitimate sites)
- Audit trail of credential access
- Emergency access procedures for business continuity
',
  'パスワードの使い回しを防ぎ、安全な認証情報の共有を可能にするため、
チーム向けパスワードマネージャー（1PasswordまたはBitwarden）の導入を
推奨します。これは、小規模チームが実施できる最も効果の高いセキュリティ
改善の一つです。

**主なメリット:**
- すべてのサービスに固有の強力なパスワード
- チームメンバー間での安全な認証情報共有
- フィッシング対策（自動入力は正規サイトでのみ機能）
- 認証情報アクセスの監査証跡
- 事業継続のための緊急アクセス手順
',
  '',
  '["security","password","authentication","1password","bitwarden"]',
  '1.0',
  'active',
  1,
  'en',
  '["en", "ja"]'
);

INSERT OR REPLACE INTO fragments (id, site_id, name, slug, category, content_en, content_ja, description, tags, version, status, is_bilingual, default_locale, available_locales)
VALUES (
  'periodic-monitoring',
  NULL,
  'DNS & Email Monitoring (Periodic)',
  'periodic-monitoring',
  'services',
  'Our Periodic service continuously monitors your domains for DNS configuration
drift and email authentication issues. You''ll receive alerts if SPF, DKIM,
or DMARC records change unexpectedly—catching misconfigurations before they
affect email deliverability or security.

**Monitoring Includes:**
- DNS record changes (A, MX, TXT, CNAME)
- SPF record validity and alignment
- DKIM key presence and rotation tracking
- DMARC policy compliance
- DNSSEC status
- Certificate transparency logs
',
  '当社のPeriodicサービスは、貴社ドメインのDNS設定の変動やメール認証の
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
',
  '',
  '["dns","email","monitoring","spf","dkim","dmarc","periodic"]',
  '1.0',
  'active',
  1,
  'en',
  '["en", "ja"]'
);

INSERT OR REPLACE INTO fragments (id, site_id, name, slug, category, content_en, content_ja, description, tags, version, status, is_bilingual, default_locale, available_locales)
VALUES (
  'website-development',
  NULL,
  'Website Development Services',
  'website-development',
  'services',
  '## eSolia Website Development

Professional website development with a focus on performance, security, and maintainability:

**Discovery & Planning**
- Requirements gathering and analysis
- Information architecture design
- Content strategy and planning
- Technical approach recommendation
- Project timeline and milestones

**Design & Development**
- Modern, responsive design
- Bilingual content support (EN/JA)
- Content management system setup
- Integration with existing systems
- Search engine optimization

**Quality Assurance**
- Cross-browser and device testing
- Performance optimization
- Security review
- Accessibility compliance
- Content review and proofreading

**Launch & Support**
- Staging environment for review
- Zero-downtime deployment
- Post-launch monitoring
- Training for content editors
- Ongoing maintenance options

**What''s Included**
- Source code ownership
- Documentation
- 30-day warranty period
- Knowledge transfer session

All websites are built on secure, globally distributed infrastructure with enterprise-grade reliability.
',
  '## eSOLIA ウェブサイト開発

パフォーマンス、セキュリティ、保守性を重視したプロフェッショナルなウェブサイト開発：

**ディスカバリー＆プランニング**
- 要件収集と分析
- 情報アーキテクチャ設計
- コンテンツ戦略と計画
- 技術的アプローチの提案
- プロジェクトタイムラインとマイルストーン

**デザイン＆開発**
- モダンでレスポンシブなデザイン
- バイリンガルコンテンツサポート（EN/JA）
- コンテンツ管理システムのセットアップ
- 既存システムとの統合
- 検索エンジン最適化

**品質保証**
- クロスブラウザおよびデバイステスト
- パフォーマンス最適化
- セキュリティレビュー
- アクセシビリティ準拠
- コンテンツレビューと校正

**ローンチ＆サポート**
- レビュー用ステージング環境
- ゼロダウンタイムデプロイメント
- ローンチ後の監視
- コンテンツ編集者向けトレーニング
- 継続的なメンテナンスオプション

**含まれるもの**
- ソースコードの所有権
- ドキュメント
- 30日間の保証期間
- ナレッジ移転セッション

すべてのウェブサイトは、エンタープライズグレードの信頼性を備えた安全でグローバルに分散されたインフラストラクチャ上に構築されます。
',
  '',
  '["website","development","project"]',
  '1.0',
  'active',
  1,
  'en',
  '["en", "ja"]'
);

INSERT OR REPLACE INTO fragments (id, site_id, name, slug, category, content_en, content_ja, description, tags, version, status, is_bilingual, default_locale, available_locales)
VALUES (
  'billing-terms',
  NULL,
  'Billing Model',
  'billing-terms',
  'terms',
  '## Billing Model

### Time and Materials

Our agreements are time-and-materials based with transparent pricing:

| Item | Description |
|------|-------------|
| **Minimum billing** | 1 hour minimum per engagement |
| **Increments** | 15-minute increments beyond minimum |
| **Administration fee** | Monthly fixed fee for account management |
| **Travel fees** | Per-visit fee for onsite work (varies by location) |

### Rate Options

Greater commitment means better rates:

- **Reserved Hours** — Regular monthly commitment at preferred rates
- **Pool Blocks** — Pre-paid time blocks (12-month validity)
- **Multi-year Term** — Reduced rates for longer commitment periods

### Payment Terms

- Invoices issued monthly
- Payment due within 30 days
- Consumption reports provided monthly
',
  '## 請求モデル

### タイム＆マテリアル

タイム＆マテリアル方式で透明性のある価格設定：

| 項目 | 説明 |
|------|------|
| **最低請求** | エンゲージメントごとに1時間最低 |
| **増分** | 最低時間を超えた分は15分単位 |
| **管理費** | アカウント管理のための月額固定料金 |
| **出張費** | オンサイト作業の訪問ごとの料金（場所により異なる） |

### レートオプション

より大きなコミットメントでより良いレート：

- **予約時間** — 優遇レートでの月次の定期的なコミットメント
- **プールブロック** — 前払い時間ブロック（12ヶ月有効）
- **複数年契約** — 長期コミットメントで割引レート

### 支払い条件

- 月次で請求書発行
- 30日以内にお支払い
- 月次で消費レポートを提供
',
  'Standard billing terms section.
Specific rates to be included in client offer.
',
  '["terms","billing","pricing","rates"]',
  '2025-01',
  'active',
  1,
  'en',
  '["en", "ja"]'
);

INSERT OR REPLACE INTO fragments (id, site_id, name, slug, category, content_en, content_ja, description, tags, version, status, is_bilingual, default_locale, available_locales)
VALUES (
  'confidentiality',
  NULL,
  'Confidentiality & Data Protection',
  'confidentiality',
  'terms',
  '## Confidentiality & Data Protection

### Mutual NDA

Both parties agree to protect confidential information:

- **Definition** — All non-public business, technical, and financial information
- **Obligations** — Use only for engagement purposes, protect as own
- **Exceptions** — Public knowledge, independently developed, legally required
- **Duration** — Survives termination for 3 years

### Data Handling

| Aspect | Commitment |
|--------|------------|
| **Access** | Need-to-know basis only |
| **Storage** | Encrypted at rest and in transit |
| **Retention** | Only for duration required |
| **Disposal** | Secure deletion on request |

### Compliance

- Japan Act on Protection of Personal Information (APPI)
- GDPR where applicable
- Industry-specific regulations as required
',
  '## 機密保持とデータ保護

### 相互NDA

両当事者が機密情報を保護することに同意：

- **定義** — すべての非公開のビジネス、技術、財務情報
- **義務** — エンゲージメント目的にのみ使用、自社同様に保護
- **例外** — 公知の情報、独自に開発、法的に要求
- **期間** — 終了後3年間継続

### データ取り扱い

| 側面 | コミットメント |
|------|--------------|
| **アクセス** | 必要に応じてのみ |
| **保存** | 保存時および転送時に暗号化 |
| **保持** | 必要な期間のみ |
| **廃棄** | 要求に応じて安全に削除 |

### コンプライアンス

- 個人情報保護法（APPI）
- 該当する場合GDPR
- 必要に応じて業界固有の規制
',
  'Standard confidentiality and data protection section.
May need customization for specific industries.
',
  '["terms","confidentiality","nda","privacy","security"]',
  '2025-01',
  'active',
  1,
  'en',
  '["en", "ja"]'
);

INSERT OR REPLACE INTO fragments (id, site_id, name, slug, category, content_en, content_ja, description, tags, version, status, is_bilingual, default_locale, available_locales)
VALUES (
  'standard-terms',
  NULL,
  'Agreement Structure',
  'standard-terms',
  'terms',
  '## Agreement Structure

### Contract Format

Our engagements use a **Master Services Agreement (MSA)** and **Statement of Work (SoW)** structure:

- **MSA** — Basic terms covering confidentiality, liability, and general conditions
- **SoW** — Specific scope, services, and pricing for each engagement

This separation allows flexibility to add services without renegotiating base terms.

### Key Terms

| Term | Description |
|------|-------------|
| **Term** | Initial term with auto-renewal options |
| **Termination** | Notice period for either party |
| **Liability** | Reasonable limitations |
| **Confidentiality** | Mutual NDA provisions |
| **IP** | Work product ownership |
',
  '## ご契約について

### 契約形式

**マスターサービス契約（MSA）**と**業務仕様書（SoW）**の構造を採用しています：

- **MSA** — 機密保持、責任、一般条件を規定する基本契約
- **SoW** — 各エンゲージメントの具体的な範囲、サービス、価格

この分離により、基本条件を再交渉することなくサービスを追加できる柔軟性があります。

### 主要条件

| 項目 | 説明 |
|------|------|
| **契約期間** | 自動更新オプション付きの初期期間 |
| **解約** | 双方の通知期間 |
| **責任** | 合理的な制限 |
| **機密保持** | 相互NDA条項 |
| **知的財産** | 成果物の所有権 |
',
  'Standard agreement structure section.
Use for any service engagement.
',
  '["terms","agreement","msa","sow","contract"]',
  '2025-01',
  'active',
  1,
  'en',
  '["en", "ja"]'
);
