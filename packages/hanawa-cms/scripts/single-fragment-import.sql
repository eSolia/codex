INSERT OR REPLACE INTO fragments (id, name, slug, category, description, content_en, content_ja, is_bilingual, tags, version, status, created_at, updated_at)
VALUES (
  'password-vault-comparison',
  'Password Vault Solutions: A Comparison Guide',
  'password-vault-comparison',
  'comparisons',
  'comparison',
  '<h2>Executive Summary</h2>
<p>Password managers are essential tools for protecting your digital identity. However, not all password managers are built the same way. This document compares leading solutions across security architecture, features, and practical considerations to help you choose the right solution for your needs.</p>
<p><strong>Key Recommendation:</strong> Choose a solution based on your priorities—maximum security, maximum convenience, or a balance of both. All solutions discussed here are significantly better than not using a password manager.</p>
<hr>
<h2>Your Master Password: The Key to Everything</h2>
<p>Your master password is the single most important credential you will ever create. It protects all your other passwords. Choose it carefully and protect it well.</p>
<p><img src="/api/diagrams/password-vault-comparison-en-1" alt="password-vault-comparison-en-1"></p>
<p><strong>The concept is simple:</strong></p>
<ul>
<li><strong>One password to remember</strong> — your master password</li>
<li><strong>Hundreds of passwords you don&#39;t</strong> — the vault generates and stores them</li>
</ul>
<p>Each password inside the vault can be long, random, and unique. You never need to memorize <code>kX9#mP2$vL5@nQ8&amp;jR4!</code> — the vault handles it. You only need to remember how to get in.</p>
<h3>Choosing a Strong Master Password</h3>
<p>The goal is a password that is <strong>long enough to be secure</strong> but <strong>memorable enough that you won&#39;t forget it</strong>.</p>
<p><strong>Recommended approach: Use a passphrase</strong></p>
<p>Instead of a complex string like <code>Tr0ub4dor&amp;3</code>, use a phrase of random words:</p>
<pre><code>correct horse battery staple</code></pre>
<p>Or a memorable sentence with personal meaning:</p>
<pre><code>My daughter Yuki was born in March 2019!</code></pre>
<p><strong>Why this works:</strong></p>
<ul>
<li>Length matters more than complexity—a 25-character passphrase is stronger than an 8-character jumble of symbols</li>
<li>You can actually remember it</li>
<li>You can type it reliably</li>
</ul>
<div data-callout-type="info" data-callout-title="️ Consider How You''ll Type It" class="callout callout-info border-l-4 p-4 my-4 rounded-r"><div class="callout-title font-semibold mb-2">️ Consider How You''ll Type It</div><div class="callout-content"><p>You''ll need to enter your master password on both desktop and mobile devices. Keep in mind:</p>
<ul>
<li><strong>Symbols can be awkward on mobile:</strong> Characters like <code>|</code>, <code>~</code>, <code>^</code>, or <code>\</code> often require multiple taps to find on phone keyboards. If you use symbols, stick to common ones easily accessible on mobile (like <code>!</code>, <code>@</code>, <code>#</code>, or <code>$</code>).</li>
<li><strong>Spaces work well:</strong> A passphrase with spaces (<code>correct horse battery staple</code>) is easy to type on any device.</li>
<li><strong>Biometrics reduce typing:</strong> Most password managers let you unlock with Face ID or fingerprint after the initial setup. Once enabled, you rarely type your master password on mobile—making a longer, more complex password practical.</li>
</ul>
<p>Test your master password on your phone before committing to it.</p></div></div>

<p><strong>Avoid:</strong></p>
<ul>
<li>Dictionary words alone (<code>password</code>, <code>sunshine</code>)</li>
<li>Personal info easily found online (birthday, pet&#39;s name, company name)</li>
<li>Patterns (<code>123456</code>, <code>qwerty</code>, <code>Password1!</code>)</li>
<li>Reusing a password from another account</li>
</ul>
<div data-callout-type="info" data-callout-title="️ Critical: Back Up Your Master Password" class="callout callout-info border-l-4 p-4 my-4 rounded-r"><div class="callout-title font-semibold mb-2">️ Critical: Back Up Your Master Password</div><div class="callout-content"><p>If you forget your master password, you will lose access to all your stored passwords permanently. Most providers cannot recover your data—this is a security feature, not a limitation.</p>
<strong>Write down your master password and store it in a secure physical location</strong> (a safe, a safety deposit box, or with a trusted person). Do not store it digitally. This written backup is your safety net if you ever forget your password or become incapacitated and someone needs access on your behalf.</div></div>

<h3>Inside the Vault: Let the Manager Do the Work</h3>
<p>Once inside your password manager, you never need to remember individual passwords again. Let the manager generate long, random passwords for each account:</p>
<pre><code>kX9#mP2$vL5@nQ8&amp;jR4!wT7*</code></pre>
<p>These are impossible to guess and impossible to remember—and that&#39;s fine, because you won&#39;t need to. The manager handles it.</p>
<hr>
<h2>Understanding Security Architecture</h2>
<p>Before comparing individual products, it&#39;s important to understand the two fundamental approaches to password manager design.</p>
<h3>Security-First vs. Convenience-First Design</h3>
<p><img src="/api/diagrams/password-vault-comparison-en-2" alt="password-vault-comparison-en-2"></p>
<p><strong>Security-First Design:</strong></p>
<ul>
<li>Decryption occurs only within the dedicated application</li>
<li>No browser extensions or web interfaces that could be compromised</li>
<li>Slower to add new features (each feature evaluated for security impact)</li>
<li>Example: Codebook</li>
</ul>
<p><strong>Convenience-First Design:</strong></p>
<ul>
<li>Multiple access points for seamless user experience</li>
<li>Browser extensions enable one-click autofill</li>
<li>Web vault allows access from any browser</li>
<li>Security measures added to protect each access point</li>
<li>Examples: 1Password, Bitwarden</li>
</ul>
<p>Neither approach is wrong—they represent different priorities. The right choice depends on your threat model and usability requirements.</p>
<div data-callout-type="info" data-callout-title="️ What is &quot;Attack Surface&quot;?" class="callout callout-info border-l-4 p-4 my-4 rounded-r"><div class="callout-title font-semibold mb-2">️ What is "Attack Surface"?</div><div class="callout-content"><p>Think of your password vault like a house. The more doors and windows you add, the more entry points a burglar could potentially use. Each entry point is part of the "attack surface."</p>
<p>A security-first password manager is like a house with one heavily reinforced door. A convenience-first manager is like a house with multiple doors (front, back, garage, side)—more convenient for you, but each door needs its own locks and security measures.</p>
<p>Both can be secure, but the single-door approach has fewer things that could go wrong.</p></div></div>

<hr>
<h2>How Cloud Sync Differs by Solution</h2>
<p><img src="/api/diagrams/password-vault-comparison-en-3" alt="password-vault-comparison-en-3"></p>
<p><strong>Traditional Cloud Vault (1Password, Bitwarden):</strong></p>
<ul>
<li>Access your passwords from any web browser</li>
<li>Convenient for accessing passwords on shared or temporary computers</li>
<li>Decryption happens in the browser via JavaScript</li>
<li>Requires trusting that the provider&#39;s servers won&#39;t serve malicious code</li>
</ul>
<p><strong>True Zero-Knowledge Sync (Codebook Cloud):</strong></p>
<ul>
<li>Cloud is used <strong>only</strong> to move encrypted data between your devices</li>
<li>No web interface—passwords can only be viewed in the native app</li>
<li>Your data is encrypted with a <strong>Sync Key</strong> before it ever reaches their servers</li>
<li><strong>Zetetic does not have your Sync Key</strong>—they literally cannot decrypt your data</li>
<li>Even if compelled by law enforcement or compromised by hackers, the provider cannot access your passwords</li>
</ul>
<div data-callout-type="info" data-callout-title="️ What is &quot;Zero Knowledge&quot;?" class="callout callout-info border-l-4 p-4 my-4 rounded-r"><div class="callout-title font-semibold mb-2">️ What is "Zero Knowledge"?</div><div class="callout-content"><p>"Zero knowledge" means the service provider knows nothing about the contents of your data. They store your encrypted vault but cannot read it.</p>
<strong>However, not all "zero knowledge" claims are equal:</strong>
<p>| Type | How it Works | Provider Can Access? |</p>
<p>|------|-------------|---------------------|</p>
<p>| <strong>Web Vault</strong> | Your password unlocks data in your browser. Provider''s servers send you the decryption code. | Theoretically yes—they could send malicious code that captures your password |</p>
<p>| <strong>Sync-Only (Codebook)</strong> | A separate Sync Key encrypts data before upload. This key never leaves your devices. | No—they don''t have the key and there''s no web interface to attack |</p>
<p>With Codebook Cloud, your Sync Key is generated on your device and stays there. Zetetic''s servers only ever see encrypted blobs they cannot decrypt. This is architecturally different from services that offer web access.</p></div></div>

<div data-callout-type="info" data-callout-title="️ Why Are Web Vaults Riskier?" class="callout callout-info border-l-4 p-4 my-4 rounded-r"><div class="callout-title font-semibold mb-2">️ Why Are Web Vaults Riskier?</div><div class="callout-content"><p>When you log into a web vault (like 1Password.com or vault.bitwarden.com), your browser downloads JavaScript code from the provider''s server, and that code decrypts your passwords.</p>
<strong>The risk:</strong> You''re trusting that the provider will always send you legitimate code. If their servers were compromised, or if a rogue employee made changes, or if law enforcement compelled them to modify the code for a specific user, the JavaScript could theoretically capture your master password.
<strong>This is not hypothetical paranoia</strong>—it''s why security researchers have long debated web-based password access. For most users, the risk is low. For high-security users (executives, journalists, activists), this architectural difference matters.
<p>Password managers without web vaults eliminate this entire category of risk.</p></div></div>

<hr>
<h2>Solution Comparison</h2>
<h3>Overview Matrix</h3>
<table><thead><tr><th>Feature</th><th>Codebook</th><th>1Password</th><th>Bitwarden</th><th>Apple Passwords</th></tr></thead><tbody><tr><td><strong>Architecture</strong></td><td>Security-first</td><td>Convenience-first</td><td>Convenience-first</td><td>Platform-integrated</td></tr>
<tr><td><strong>TOTP Codes</strong></td><td>✓ Built-in</td><td>✓ Built-in</td><td>✓ Built-in</td><td>✓ Built-in</td></tr>
<tr><td><strong>Browser Extension</strong></td><td>✗ (by design)</td><td>✓</td><td>✓</td><td>⚠️ Chrome/Edge only, unreliable on Windows</td></tr>
<tr><td><strong>Web Vault</strong></td><td>✗ (by design)</td><td>✓</td><td>✓</td><td>✗</td></tr>
<tr><td><strong>Platforms</strong></td><td>Win, Mac, iOS, Android</td><td>All + Linux</td><td>All + Linux</td><td>Apple only (Windows buggy)</td></tr>
<tr><td><strong>Family/Team Sharing</strong></td><td>✓ (new in 2026)</td><td>✓</td><td>✓</td><td>Apple users only</td></tr>
<tr><td><strong>Open Source</strong></td><td>SQLCipher (encryption)</td><td>✗</td><td>✓ Full</td><td>✗</td></tr>
<tr><td><strong>Self-Host Option</strong></td><td>Local-only available</td><td>✗</td><td>✓</td><td>✗</td></tr>
<tr><td><strong>Breach Monitoring</strong></td><td>✓ HaveIBeenPwned</td><td>✓ Watchtower</td><td>✓ Reports</td><td>✓ Basic</td></tr>
<tr><td><strong>Price (Individual)</strong></td><td>$60/year</td><td>$36/year</td><td>Free–$10/year</td><td>Free</td></tr></tbody></table>
<div data-callout-type="info" data-callout-title="️ What is TOTP?" class="callout callout-info border-l-4 p-4 my-4 rounded-r"><div class="callout-title font-semibold mb-2">️ What is TOTP?</div><div class="callout-content"><p>TOTP (Time-based One-Time Password) is the technology behind those 6-digit codes that change every 30 seconds. When a website offers "authenticator app" as a two-factor option, it''s using TOTP.</p>
<p>Modern password managers can store and generate these codes alongside your passwords, so you don''t need a separate authenticator app for most accounts. You''ll still see the term "2FA" (two-factor authentication) or "MFA" (multi-factor authentication) used interchangeably with TOTP in many contexts.</p></div></div>

<h3>Business Pricing Comparison</h3>
<p>For organizations, all three major solutions offer business-specific plans with administrative controls, centralized billing, and onboarding support. <strong>If you are using these tools for business purposes, the business plans are required</strong> and provide features essential for organizational management.</p>
<table><thead><tr><th>Team Size</th><th>Codebook Business</th><th>1Password</th><th>Bitwarden Teams</th><th>Bitwarden Enterprise</th></tr></thead><tbody><tr><td><strong>5 users</strong></td><td>~$300/year*</td><td>$240/year (Starter)</td><td>$240/year</td><td>$360/year</td></tr>
<tr><td><strong>10 users</strong></td><td>~$600/year*</td><td>$240/year (Starter)</td><td>$480/year</td><td>$720/year</td></tr>
<tr><td><strong>50 users</strong></td><td>Contact sales</td><td>$4,794/year</td><td>$2,400/year</td><td>$3,600/year</td></tr>
<tr><td><strong>Per-user rate</strong></td><td>From $5/user/mo</td><td>$7.99/user/mo</td><td>$4/user/mo</td><td>$6/user/mo</td></tr></tbody></table>
<p>*Codebook Business starts at $5/user/month with volume discounts available for larger teams. Contact sales for exact pricing.</p>
<p><strong>Key Business Plan Features:</strong></p>
<table><thead><tr><th>Feature</th><th>Codebook Business</th><th>1Password Business</th><th>Bitwarden Teams</th><th>Bitwarden Enterprise</th></tr></thead><tbody><tr><td>Centralized billing</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>
<tr><td>User management dashboard</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>
<tr><td>Sharing permissions</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>
<tr><td>SSO integration</td><td>✗</td><td>✓</td><td>✗</td><td>✓</td></tr>
<tr><td>Directory sync (SCIM)</td><td>✗</td><td>✓</td><td>✗</td><td>✓</td></tr>
<tr><td>Self-hosting option</td><td>✗</td><td>✗</td><td>✓</td><td>✓</td></tr>
<tr><td>Free Families for users</td><td>✗</td><td>✓</td><td>✗</td><td>✓</td></tr></tbody></table>
<p><strong>Business Plan Links:</strong></p>
<ul>
<li><strong>Codebook Business:</strong> <a href="https://www.zetetic.net/codebook/business/">https://www.zetetic.net/codebook/business/</a></li>
<li><strong>1Password Teams/Business:</strong> <a href="https://1password.com/pricing/password-manager">https://1password.com/pricing/password-manager</a></li>
<li><strong>Bitwarden Business:</strong> <a href="https://bitwarden.com/pricing/business/">https://bitwarden.com/pricing/business/</a></li>
</ul>
<p><strong>Note:</strong> Volume discounts are typically available from all vendors for larger deployments (generally 100+ users). Contact sales for custom pricing.</p>
<h3>Detailed Profiles</h3>
<h4>Codebook (by Zetetic)</h4>
<p><strong>Philosophy:</strong> Maximum security through minimal attack surface.</p>
<p><strong>Strengths:</strong></p>
<ul>
<li>25+ year track record with no breaches</li>
<li>SQLCipher encryption (used by NASA, Samsung, Fortune 500 companies)</li>
<li>No browser extension or web vault means no browser-based attack vectors</li>
<li><strong>True zero-knowledge cloud sync:</strong> Codebook Cloud encrypts your data with a Sync Key that is generated on your device and never uploaded. Zetetic cannot see your passwords, cannot be compelled to hand them over, and cannot be hacked in a way that exposes your data.</li>
<li>Even your master password isn&#39;t used for cloud encryption—a separate, fully random Sync Key protects against password-cracking attacks</li>
<li>Responsive, personal customer support from a company focused solely on security</li>
</ul>
<div data-callout-type="info" data-callout-title="️ Why the Separate Sync Key Matters" class="callout callout-info border-l-4 p-4 my-4 rounded-r"><div class="callout-title font-semibold mb-2">️ Why the Separate Sync Key Matters</div><div class="callout-content"><p>Most people choose memorable (and thus somewhat guessable) master passwords. Advanced attackers can try billions of password guesses against encrypted data.</p>
<p>Codebook Cloud doesn''t encrypt your sync data with your master password. Instead, it uses a completely random Sync Key—a long string of random characters that''s impossible to guess. This key lives only on your devices. Even if someone stole the encrypted data from Zetetic''s servers, cracking it would be mathematically infeasible.</p></div></div>

<p><strong>Considerations:</strong></p>
<ul>
<li>Autofill via Secret Agent requires slightly more interaction than browser extensions</li>
<li>No Linux support</li>
<li>Smaller company (though stable for 25+ years)</li>
<li>Less brand recognition than larger competitors</li>
</ul>
<p><strong>Best for:</strong> Users who prioritize security architecture over seamless convenience; organizations with strict security requirements; privacy-conscious individuals; anyone who wants their provider to have zero ability to access their data.</p>
<hr>
<h4>1Password</h4>
<p><strong>Philosophy:</strong> Best-in-class user experience with strong security measures.</p>
<p><strong>Strengths:</strong></p>
<ul>
<li>Excellent, polished user interface across all platforms</li>
<li>Browser extension autofill works reliably</li>
<li>Secret Key adds extra encryption layer beyond master password</li>
<li>Travel Mode can hide sensitive vaults when crossing borders</li>
<li>Strong enterprise management features</li>
<li>Never experienced a data breach</li>
</ul>
<p><strong>Considerations:</strong></p>
<ul>
<li>No free tier (14-day trial only)</li>
<li>Web vault means passwords can be decrypted in browser context</li>
<li>Closed-source (relies on third-party audits for verification)</li>
<li>Higher price point</li>
</ul>
<p><strong>Best for:</strong> Users who prioritize seamless experience; families who need easy sharing; enterprises requiring management features.</p>
<hr>
<h4>Bitwarden</h4>
<p><strong>Philosophy:</strong> Transparent, open-source security accessible to everyone.</p>
<p><strong>Strengths:</strong></p>
<ul>
<li>Fully open-source and regularly audited</li>
<li>Generous free tier with unlimited passwords and devices</li>
<li>Self-hosting option for complete control</li>
<li>Browser extension and web vault for convenience</li>
<li>Strong organizational features at reasonable prices</li>
<li>Active development with frequent updates</li>
</ul>
<p><strong>Considerations:</strong></p>
<ul>
<li>User interface less polished than 1Password</li>
<li>Autofill can be inconsistent on some platforms</li>
<li>Web vault means passwords can be decrypted in browser context (see earlier section on web vault risks)</li>
<li>VC funding raises questions about future direction (though open-source code would survive any company changes)</li>
</ul>
<p><strong>Best for:</strong> Budget-conscious users; open-source advocates; organizations wanting self-hosted option; technical users comfortable with less polished UI.</p>
<div data-callout-type="info" data-callout-title="️ What Does &quot;Open Source&quot; Mean for Security?" class="callout callout-info border-l-4 p-4 my-4 rounded-r"><div class="callout-title font-semibold mb-2">️ What Does "Open Source" Mean for Security?</div><div class="callout-content"><p>Open-source software publishes its complete code publicly. Anyone can inspect it for security flaws or hidden backdoors. This transparency means:</p>
<ul>
<li>Independent security researchers can (and do) audit the code</li>
<li>Backdoors or malicious code would be discovered quickly</li>
<li>You don''t have to trust the company''s claims—you can verify</li>
</ul>
<p>Bitwarden is fully open-source. Codebook uses SQLCipher, which is open-source encryption, though the application itself is not. 1Password and Apple Passwords are closed-source.</p></div></div>

<hr>
<h4>Apple Passwords (iCloud Keychain)</h4>
<p><strong>Philosophy:</strong> Seamless integration within Apple ecosystem.</p>
<p><strong>Strengths:</strong></p>
<ul>
<li>Free and built into Apple devices</li>
<li>Zero setup required for Apple devices</li>
<li>Face ID / Touch ID integration is seamless</li>
<li>Passkey support</li>
<li>Strong encryption</li>
</ul>
<p><strong>Considerations:</strong></p>
<ul>
<li>Only works reliably within Apple ecosystem</li>
<li><strong>Windows support is problematic:</strong> iCloud for Windows exists but has well-documented issues:<ul>
<li>Passwords app frequently crashes on Windows 11</li>
<li>Approval/sync process often fails in a loop (2FA codes accepted but nothing happens)</li>
<li>Sync can break after iOS or Windows updates</li>
<li>Autofill in Edge/Chrome extensions is inconsistent</li>
<li>Requires specific conditions: same network, VPN disabled, Windows Hello enabled</li>
<li>Troubleshooting is difficult with limited diagnostic tools</li>
</ul>
</li>
<li>No Android support whatsoever</li>
<li>Cannot share passwords with non-Apple users</li>
<li>Limited control and export options</li>
<li>Browser extension only available for Chrome and Edge (not Firefox)</li>
</ul>
<p><strong>Best for:</strong> Apple-only organizations with no Windows PCs and no need to share outside Apple ecosystem. Not recommended for mixed Apple/Windows environments due to reliability issues.</p>
<hr>
<h4>Browser-Based Managers (Chrome, Edge, Firefox)</h4>
<p><strong>Philosophy:</strong> Convenient, integrated with existing workflow.</p>
<p><strong>Strengths:</strong></p>
<ul>
<li>Already available, no additional installation</li>
<li>Free</li>
<li>Syncs with browser account</li>
</ul>
<p><strong>Considerations:</strong></p>
<ul>
<li>Single point of failure (browser account compromise = all passwords exposed)</li>
<li>No true zero-knowledge architecture</li>
<li>Limited to browser context</li>
<li>No TOTP support</li>
<li>Provider (Google, Microsoft) can potentially access data</li>
</ul>
<p><strong>Best for:</strong> Users who will not adopt a dedicated solution; temporary measure while transitioning to a proper password manager.</p>
<div data-callout-type="info" data-callout-title="️ Why Browser Password Managers Are the Least Secure Option" class="callout callout-info border-l-4 p-4 my-4 rounded-r"><div class="callout-title font-semibold mb-2">️ Why Browser Password Managers Are the Least Secure Option</div><div class="callout-content"><p>When you save passwords in Chrome, they''re tied to your Google account. This means:</p>
<p>1. <strong>Google can access them:</strong> Unlike dedicated password managers, browser-stored passwords are not truly "zero knowledge." Google can (and does, for sync purposes) process this data.</p>
<p>2. <strong>One password unlocks everything:</strong> If someone gains access to your Google/Microsoft account (through phishing, password reuse, or a data breach), they get your email AND all your passwords simultaneously.</p>
<p>3. <strong>No separation of concerns:</strong> A dedicated password manager is a single-purpose security tool. A browser is a complex application that visits untrusted websites, runs unknown JavaScript, and has a massive attack surface.</p>
<p>Browser password managers are better than nothing, but they''re the weakest option for anyone taking security seriously.</p></div></div>

<hr>
<h2>Security Architecture Comparison</h2>
<p><img src="/api/diagrams/password-vault-comparison-en-4" alt="password-vault-comparison-en-4"></p>
<p><strong>Summary:</strong> Codebook&#39;s architecture eliminates entire categories of network and browser-based threats by design. Solutions with browser extensions and web vaults have additional vectors that must be defended.</p>
<div data-callout-type="info" data-callout-title="️ What About Malware on Your Device?" class="callout callout-info border-l-4 p-4 my-4 rounded-r"><div class="callout-title font-semibold mb-2">️ What About Malware on Your Device?</div><div class="callout-content"><p>You may wonder: "If malware gets on my computer, can''t it steal my passwords?"</p>
<p>The answer is nuanced. A locked vault with a strong master password is extremely difficult to crack—the encryption used by these tools (AES-256, SQLCipher) would take longer than the age of the universe to brute-force.</p>
<strong>The real risk from malware is capturing your master password:</strong>
<ul>
<li>A keylogger could record you typing your master password</li>
<li>Screen capture software could see your passwords when displayed</li>
<li>Memory-scraping malware could read passwords while your vault is unlocked</li>
</ul>
<strong>How to protect yourself:</strong>
<ul>
<li>Use a strong, unique master password (see previous section)</li>
<li>Keep your operating system and software updated</li>
<li>Don''t install software from untrusted sources</li>
<li>Lock your vault when not actively using it</li>
<li>On mobile, use biometrics (Face ID, fingerprint) instead of typing your master password</li>
</ul>
<strong>Bottom line:</strong> If your device is compromised by sophisticated malware, no password manager can fully protect you. But this is true of any security tool. The vault encryption itself remains strong.</div></div>

<p><strong>Note:</strong> This does not mean 1Password or Bitwarden are insecure—they implement strong protections for each access point. The diagram shows the architectural difference in network-facing attack surface.</p>
<hr>
<h2>Decision Framework</h2>
<h3>Choose Based on Your Priorities</h3>
<p><img src="/api/diagrams/password-vault-comparison-en-5" alt="password-vault-comparison-en-5"></p>
<h3>Quick Reference</h3>
<table><thead><tr><th>If you value...</th><th>Choose...</th></tr></thead><tbody><tr><td>Maximum security, minimal attack surface</td><td>Codebook</td></tr>
<tr><td>Seamless experience, polished UI</td><td>1Password</td></tr>
<tr><td>Open source, budget-friendly, self-host option</td><td>Bitwarden</td></tr>
<tr><td>Apple ecosystem integration, zero setup</td><td>Apple Passwords</td></tr></tbody></table>
<hr>
<h2>Advanced: The Convenience Layer Pattern</h2>
<p>Some users find an effective middle ground by using a security-first vault as their authoritative source while adding a thin &quot;convenience layer&quot; for frequently-accessed sites.</p>
<p><img src="/api/diagrams/password-vault-comparison-en-6" alt="password-vault-comparison-en-6"></p>
<h3>Why This Works</h3>
<ul>
<li><strong>Security architecture preserved:</strong> Your authoritative vault maintains maximum security</li>
<li><strong>Frictionless daily use:</strong> Face ID autofill for the handful of sites you access constantly</li>
<li><strong>Resilience:</strong> If the convenience layer breaks, you don&#39;t care—the real data is in your primary vault</li>
<li><strong>No version confusion:</strong> Primary vault is always the source of truth</li>
</ul>
<h3>The Discipline Required</h3>
<ol>
<li><strong>Update primary vault first</strong>, then copy to convenience layer if needed</li>
<li><strong>Keep the convenience layer minimal</strong>—only truly high-frequency logins</li>
<li><strong>Never store anything exclusively in the convenience layer</strong></li>
<li><strong>Periodic cleanup</strong>—remove stale entries from convenience layer</li>
</ol>
<h3>When to Consider This Pattern</h3>
<ul>
<li>You&#39;ve chosen a security-first solution but want smoother autofill for a few sites</li>
<li>You access certain sites dozens of times daily</li>
<li>You&#39;re disciplined enough to maintain the primary-first habit</li>
</ul>
<p>This pattern addresses the &quot;but I want one-tap autofill&quot; concern without abandoning security-first architecture.</p>
<hr>
<h2>Important Notes</h2>
<h3>Microsoft Authenticator Update</h3>
<p>As of August 2025, Microsoft Authenticator no longer functions as a password manager. Microsoft removed all password storage and autofill features. The app continues to work for:</p>
<ul>
<li>Multi-factor authentication (MFA) push notifications</li>
<li>Time-based one-time passwords (TOTP)</li>
<li>Passkeys</li>
</ul>
<p>If you previously stored passwords in Microsoft Authenticator, that data is no longer accessible. Please ensure you have migrated to an alternative solution.</p>
<h3>Multi-Factor Authentication Recommendation</h3>
<p>Regardless of which password manager you choose, we recommend:</p>
<ul>
<li>Using your password manager&#39;s built-in TOTP for most accounts</li>
<li>Using Microsoft Authenticator specifically for Microsoft 365 MFA where required by Conditional Access policies</li>
</ul>
<p>This separation ensures your password vault and MFA are not dependent on a single application.</p>
<hr>
<h2>Next Steps</h2>
<ol>
<li><strong>Evaluate</strong> your priorities using the decision framework above</li>
<li><strong>Trial</strong> your preferred solution (most offer free trials)</li>
<li><strong>Export</strong> your current passwords from existing sources (browser, etc.)</li>
<li><strong>Import</strong> into your new password manager</li>
<li><strong>Enable</strong> two-factor authentication on critical accounts</li>
<li><strong>Delete</strong> passwords from less secure locations (browser storage, etc.)</li>
</ol>
<div data-callout-type="info" data-callout-title="️ Don''t Forget Your Backup Keys" class="callout callout-info border-l-4 p-4 my-4 rounded-r"><div class="callout-title font-semibold mb-2">️ Don''t Forget Your Backup Keys</div><div class="callout-content"><p>Depending on which solution you choose, you may need to securely store:</p>
<ul>
<li><strong>Master Password:</strong> Write it down and store in a safe place (all solutions)</li>
<li><strong>Sync Key:</strong> Codebook Cloud generates a separate key for sync—back this up too</li>
<li><strong>Secret Key:</strong> 1Password provides an Emergency Kit PDF—print and store it</li>
<li><strong>Recovery Codes:</strong> Many services provide one-time recovery codes—save these</li>
</ul>
<p>Store these physical backups where a trusted family member could find them if needed. A fireproof safe or safety deposit box is ideal.</p></div></div>

<p>We are available to assist with migration, setup, and training for any of these solutions.</p>',
  '<h2>エグゼクティブサマリー</h2>
<p>パスワードマネージャーは、デジタルアイデンティティを保護するための必須ツールです。しかし、すべてのパスワードマネージャーが同じ設計思想で作られているわけではありません。本書では、セキュリティアーキテクチャ、機能、実用的な観点から主要なソリューションを比較し、お客様のニーズに最適なソリューション選定をサポートします。</p>
<p><strong>主な推奨事項:</strong> 最大限のセキュリティ、最大限の利便性、またはその両方のバランスなど、優先事項に基づいてソリューションを選択してください。本書で紹介するすべてのソリューションは、パスワードマネージャーを使用しない場合と比較して、大幅にセキュリティが向上します。</p>
<hr>
<h2>マスターパスワード：すべての鍵</h2>
<p>マスターパスワードは、あなたが作成する最も重要な認証情報です。他のすべてのパスワードを保護します。慎重に選び、しっかり保護してください。</p>
<p><img src="/api/diagrams/password-vault-comparison-ja-1" alt="password-vault-comparison-ja-1"></p>
<p><strong>コンセプトはシンプルです：</strong></p>
<ul>
<li><strong>覚えるパスワードは1つ</strong> — マスターパスワード</li>
<li><strong>覚えなくていいパスワードは数百</strong> — ボールトが生成・保存</li>
</ul>
<p>ボールト内の各パスワードは、長く、ランダムで、ユニークにできます。<code>kX9#mP2$vL5@nQ8&amp;jR4!</code>を暗記する必要はありません。ボールトが処理します。入り方だけ覚えればいいのです。</p>
<h3>強力なマスターパスワードの選び方</h3>
<p>目標は、<strong>十分に長くて安全</strong>でありながら、<strong>忘れないように覚えやすい</strong>パスワードです。</p>
<p><strong>推奨アプローチ：パスフレーズを使用する</strong></p>
<p><code>Tr0ub4dor&amp;3</code>のような複雑な文字列の代わりに、ランダムな単語のフレーズを使用します：</p>
<pre><code>correct horse battery staple</code></pre>
<p>または、個人的な意味を持つ覚えやすい文章：</p>
<pre><code>娘のゆきは2019年3月に生まれました!</code></pre>
<p><strong>なぜこれが機能するか：</strong></p>
<ul>
<li>複雑さよりも長さが重要—25文字のパスフレーズは、8文字の記号の羅列より強力</li>
<li>実際に覚えられる</li>
<li>確実にタイプできる</li>
</ul>
<div data-callout-type="info" data-callout-title="️ 入力方法を考慮する" class="callout callout-info border-l-4 p-4 my-4 rounded-r"><div class="callout-title font-semibold mb-2">️ 入力方法を考慮する</div><div class="callout-content"><p>マスターパスワードはデスクトップとモバイルの両方で入力する必要があります。以下の点に注意してください：</p>
<ul>
<li><strong>記号はモバイルで入力しにくい場合がある：</strong> <code>|</code>、<code>~</code>、<code>^</code>、<code>\</code>などの文字は、スマートフォンのキーボードで見つけるのに複数回タップが必要なことがあります。記号を使う場合は、モバイルで簡単にアクセスできる一般的なもの（<code>!</code>、<code>@</code>、<code>#</code>、<code>$</code>など）にしましょう。</li>
<li><strong>スペースは使いやすい：</strong> スペースを含むパスフレーズ（<code>correct horse battery staple</code>）は、どのデバイスでも簡単に入力できます。</li>
<li><strong>生体認証で入力を減らす：</strong> ほとんどのパスワードマネージャーは、初期設定後にFace IDや指紋でロック解除できます。有効にすると、モバイルでマスターパスワードを入力することはほとんどなくなり、より長く複雑なパスワードが実用的になります。</li>
</ul>
<p>マスターパスワードを決める前に、スマートフォンでテストしてみてください。</p></div></div>

<p><strong>避けるべきもの：</strong></p>
<ul>
<li>辞書の単語だけ（<code>password</code>、<code>sunshine</code>）</li>
<li>オンラインで簡単に見つかる個人情報（誕生日、ペットの名前、会社名）</li>
<li>パターン（<code>123456</code>、<code>qwerty</code>、<code>Password1!</code>）</li>
<li>他のアカウントのパスワードの再利用</li>
</ul>
<div data-callout-type="info" data-callout-title="️ 重要：マスターパスワードをバックアップしてください" class="callout callout-info border-l-4 p-4 my-4 rounded-r"><div class="callout-title font-semibold mb-2">️ 重要：マスターパスワードをバックアップしてください</div><div class="callout-content"><p>マスターパスワードを忘れると、保存されているすべてのパスワードへのアクセスが永久に失われます。ほとんどのプロバイダーはデータを復旧できません。これは制限ではなく、セキュリティ機能です。</p>
<strong>マスターパスワードを紙に書いて、安全な物理的場所に保管してください</strong>（金庫、貸金庫、または信頼できる人のもと）。デジタルで保存しないでください。この紙のバックアップは、パスワードを忘れた場合や、万が一の際に代理でアクセスが必要な場合のセーフティネットです。</div></div>

<h3>ボールト内：マネージャーに任せる</h3>
<p>パスワードマネージャーの中では、個々のパスワードを覚える必要はありません。各アカウントに長くランダムなパスワードを生成させましょう：</p>
<pre><code>kX9#mP2$vL5@nQ8&amp;jR4!wT7*</code></pre>
<p>これらは推測不可能で覚えることも不可能ですが、それで問題ありません。マネージャーが処理してくれます。</p>
<hr>
<h2>セキュリティアーキテクチャの理解</h2>
<p>個々の製品を比較する前に、パスワードマネージャー設計における2つの基本的なアプローチを理解することが重要です。</p>
<h3>セキュリティ優先設計 vs 利便性優先設計</h3>
<p><img src="/api/diagrams/password-vault-comparison-ja-2" alt="password-vault-comparison-ja-2"></p>
<p><strong>セキュリティ優先設計:</strong></p>
<ul>
<li>復号は専用アプリケーション内でのみ実行</li>
<li>侵害される可能性のあるブラウザ拡張機能やWebインターフェースなし</li>
<li>新機能の追加に慎重（各機能のセキュリティ影響を評価）</li>
<li>例: Codebook</li>
</ul>
<p><strong>利便性優先設計:</strong></p>
<ul>
<li>シームレスなユーザー体験のための複数のアクセスポイント</li>
<li>ブラウザ拡張機能によるワンクリック自動入力</li>
<li>任意のブラウザからアクセス可能なWebボールト</li>
<li>各アクセスポイントを保護するセキュリティ対策を追加</li>
<li>例: 1Password、Bitwarden</li>
</ul>
<p>どちらのアプローチも間違いではありません。異なる優先事項を表しています。適切な選択は、脅威モデルと使いやすさの要件によって異なります。</p>
<div data-callout-type="info" data-callout-title="️ 「攻撃対象領域」とは？" class="callout callout-info border-l-4 p-4 my-4 rounded-r"><div class="callout-title font-semibold mb-2">️ 「攻撃対象領域」とは？</div><div class="callout-content"><p>パスワード保管庫を家に例えてみましょう。ドアや窓を増やすほど、泥棒が侵入できる可能性のある入口が増えます。この入口の総数が「攻撃対象領域」です。</p>
<p>セキュリティ優先のパスワードマネージャーは、頑丈に強化された1つのドアを持つ家のようなものです。利便性優先のマネージャーは、複数のドア（玄関、裏口、ガレージ、勝手口）を持つ家のようなもので、あなたにとっては便利ですが、それぞれのドアに独自の鍵とセキュリティ対策が必要です。</p>
<p>どちらも安全にできますが、ドアが1つだけのアプローチは、問題が発生する可能性のある箇所が少なくなります。</p></div></div>

<hr>
<h2>クラウド同期の違い</h2>
<p><img src="/api/diagrams/password-vault-comparison-ja-3" alt="password-vault-comparison-ja-3"></p>
<p><strong>従来型クラウドボールト（1Password、Bitwarden）:</strong></p>
<ul>
<li>任意のWebブラウザからパスワードにアクセス可能</li>
<li>共有または一時的なコンピューターでパスワードにアクセスするのに便利</li>
<li>ブラウザ内でJavaScriptによる復号が実行される</li>
<li>プロバイダーのサーバーが悪意のあるコードを配信しないことへの信頼が必要</li>
</ul>
<p><strong>真のゼロ知識同期（Codebook Cloud）:</strong></p>
<ul>
<li>クラウドはデバイス間で暗号化データを移動するため<strong>のみ</strong>に使用</li>
<li>Webインターフェースなし—パスワードはネイティブアプリでのみ表示可能</li>
<li>データはサーバーに到達する前に<strong>同期キー</strong>で暗号化される</li>
<li><strong>Zeteticは同期キーを持っていない</strong>—文字通りデータを復号できない</li>
<li>法執行機関に強制されても、ハッカーに侵害されても、プロバイダーはパスワードにアクセスできない</li>
</ul>
<div data-callout-type="info" data-callout-title="️ 「ゼロ知識」とは？" class="callout callout-info border-l-4 p-4 my-4 rounded-r"><div class="callout-title font-semibold mb-2">️ 「ゼロ知識」とは？</div><div class="callout-content"><p>「ゼロ知識」とは、サービスプロバイダーがデータの内容について何も知らないことを意味します。暗号化された保管庫を保存しますが、読むことができません。</p>
<strong>ただし、「ゼロ知識」の主張はすべて同じではありません：</strong>
<p>| タイプ | 仕組み | プロバイダーはアクセス可能？ |</p>
<p>|--------|-------|---------------------------|</p>
<p>| <strong>Webボールト</strong> | パスワードでブラウザ内のデータを解除。プロバイダーのサーバーが復号コードを送信。 | 理論上可能—パスワードをキャプチャする悪意のあるコードを送信できる |</p>
<p>| <strong>同期専用（Codebook）</strong> | 別個の同期キーがアップロード前にデータを暗号化。このキーはデバイスから離れない。 | 不可能—キーを持っておらず、攻撃できるWebインターフェースもない |</p>
<p>Codebook Cloudでは、同期キーはデバイス上で生成され、そこに留まります。Zeteticのサーバーは、復号できない暗号化されたデータの塊しか見ることができません。これは、Webアクセスを提供するサービスとはアーキテクチャ的に異なります。</p></div></div>

<div data-callout-type="info" data-callout-title="️ なぜWebボールトはリスクが高いのか？" class="callout callout-info border-l-4 p-4 my-4 rounded-r"><div class="callout-title font-semibold mb-2">️ なぜWebボールトはリスクが高いのか？</div><div class="callout-content"><p>Webボールト（1Password.comやvault.bitwarden.comなど）にログインすると、ブラウザがプロバイダーのサーバーからJavaScriptコードをダウンロードし、そのコードがパスワードを復号します。</p>
<strong>リスク:</strong> プロバイダーが常に正当なコードを送信することを信頼しています。サーバーが侵害された場合、不正な従業員が変更を加えた場合、または法執行機関が特定のユーザーに対してコードを変更するよう強制した場合、JavaScriptは理論的にマスターパスワードをキャプチャできます。
<strong>これは仮定の妄想ではありません</strong>—セキュリティ研究者がWebベースのパスワードアクセスについて長年議論してきた理由です。ほとんどのユーザーにとって、リスクは低いです。高セキュリティユーザー（経営者、ジャーナリスト、活動家）にとって、このアーキテクチャの違いは重要です。
<p>Webボールトを持たないパスワードマネージャーは、このリスクカテゴリ全体を排除します。</p></div></div>

<hr>
<h2>ソリューション比較</h2>
<h3>概要マトリックス</h3>
<table><thead><tr><th>機能</th><th>Codebook</th><th>1Password</th><th>Bitwarden</th><th>Appleパスワード</th></tr></thead><tbody><tr><td><strong>アーキテクチャ</strong></td><td>セキュリティ優先</td><td>利便性優先</td><td>利便性優先</td><td>プラットフォーム統合</td></tr>
<tr><td><strong>TOTPコード</strong></td><td>✓ 内蔵</td><td>✓ 内蔵</td><td>✓ 内蔵</td><td>✓ 内蔵</td></tr>
<tr><td><strong>ブラウザ拡張機能</strong></td><td>✗（設計上）</td><td>✓</td><td>✓</td><td>⚠️ Chrome/Edgeのみ、Windowsで不安定</td></tr>
<tr><td><strong>Webボールト</strong></td><td>✗（設計上）</td><td>✓</td><td>✓</td><td>✗</td></tr>
<tr><td><strong>対応プラットフォーム</strong></td><td>Win, Mac, iOS, Android</td><td>全て + Linux</td><td>全て + Linux</td><td>Apple製品のみ（Windowsは不安定）</td></tr>
<tr><td><strong>家族/チーム共有</strong></td><td>✓（2026年新機能）</td><td>✓</td><td>✓</td><td>Appleユーザーのみ</td></tr>
<tr><td><strong>オープンソース</strong></td><td>SQLCipher（暗号化）</td><td>✗</td><td>✓ 完全</td><td>✗</td></tr>
<tr><td><strong>セルフホストオプション</strong></td><td>ローカルのみ可能</td><td>✗</td><td>✓</td><td>✗</td></tr>
<tr><td><strong>漏洩監視</strong></td><td>✓ HaveIBeenPwned</td><td>✓ Watchtower</td><td>✓ レポート</td><td>✓ 基本的</td></tr>
<tr><td><strong>価格（個人）</strong></td><td>約9,000円/年</td><td>約5,500円/年</td><td>無料〜約1,500円/年</td><td>無料</td></tr></tbody></table>
<div data-callout-type="info" data-callout-title="️ TOTPとは？" class="callout callout-info border-l-4 p-4 my-4 rounded-r"><div class="callout-title font-semibold mb-2">️ TOTPとは？</div><div class="callout-content"><p>TOTP（Time-based One-Time Password、時間ベースのワンタイムパスワード）は、30秒ごとに変わる6桁のコードの背後にある技術です。ウェブサイトが二要素認証のオプションとして「認証アプリ」を提供している場合、TOTPを使用しています。</p>
<p>最新のパスワードマネージャーは、パスワードと一緒にこれらのコードを保存して生成できるため、ほとんどのアカウントで別の認証アプリは必要ありません。多くの文脈で「2FA」（二要素認証）や「MFA」（多要素認証）という用語がTOTPと互換的に使用されています。</p></div></div>

<h3>ビジネス向け料金比較</h3>
<p>組織向けには、3つの主要ソリューションすべてが管理機能、一括請求、オンボーディングサポートを含むビジネス専用プランを提供しています。<strong>ビジネス目的でこれらのツールを使用する場合、ビジネスプランが必要</strong>であり、組織管理に不可欠な機能を提供します。</p>
<table><thead><tr><th>チーム規模</th><th>Codebook Business</th><th>1Password</th><th>Bitwarden Teams</th><th>Bitwarden Enterprise</th></tr></thead><tbody><tr><td><strong>5ユーザー</strong></td><td>約45,000円/年*</td><td>約36,000円/年 (Starter)</td><td>約36,000円/年</td><td>約54,000円/年</td></tr>
<tr><td><strong>10ユーザー</strong></td><td>約90,000円/年*</td><td>約36,000円/年 (Starter)</td><td>約72,000円/年</td><td>約108,000円/年</td></tr>
<tr><td><strong>50ユーザー</strong></td><td>要お問い合わせ</td><td>約720,000円/年</td><td>約360,000円/年</td><td>約540,000円/年</td></tr>
<tr><td><strong>ユーザー単価</strong></td><td>$5/月〜</td><td>$7.99/月</td><td>$4/月</td><td>$6/月</td></tr></tbody></table>
<p>*Codebook Businessは$5/ユーザー/月から開始、大規模チーム向けのボリュームディスカウントあり。正確な価格についてはセールスまでお問い合わせください。</p>
<p><strong>ビジネスプランの主な機能:</strong></p>
<table><thead><tr><th>機能</th><th>Codebook Business</th><th>1Password Business</th><th>Bitwarden Teams</th><th>Bitwarden Enterprise</th></tr></thead><tbody><tr><td>一括請求</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>
<tr><td>ユーザー管理ダッシュボード</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>
<tr><td>共有権限設定</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>
<tr><td>SSO連携</td><td>✗</td><td>✓</td><td>✗</td><td>✓</td></tr>
<tr><td>ディレクトリ同期 (SCIM)</td><td>✗</td><td>✓</td><td>✗</td><td>✓</td></tr>
<tr><td>セルフホストオプション</td><td>✗</td><td>✗</td><td>✓</td><td>✓</td></tr>
<tr><td>ユーザーへの無料Families</td><td>✗</td><td>✓</td><td>✗</td><td>✓</td></tr></tbody></table>
<p><strong>ビジネスプランのリンク:</strong></p>
<ul>
<li><strong>Codebook Business:</strong> <a href="https://www.zetetic.net/codebook/business/">https://www.zetetic.net/codebook/business/</a></li>
<li><strong>1Password Teams/Business:</strong> <a href="https://1password.com/pricing/password-manager">https://1password.com/pricing/password-manager</a></li>
<li><strong>Bitwarden Business:</strong> <a href="https://bitwarden.com/pricing/business/">https://bitwarden.com/pricing/business/</a></li>
</ul>
<p><strong>注:</strong> 大規模導入（一般的に100ユーザー以上）では、すべてのベンダーからボリュームディスカウントが利用可能です。カスタム価格についてはセールスまでお問い合わせください。</p>
<h3>詳細プロファイル</h3>
<h4>Codebook（Zetetic社）</h4>
<p><strong>設計思想:</strong> 最小限の攻撃対象領域による最大限のセキュリティ</p>
<p><strong>強み:</strong></p>
<ul>
<li>25年以上の実績、漏洩事故なし</li>
<li>SQLCipher暗号化（NASA、Samsung、Fortune 500企業が使用）</li>
<li>ブラウザ拡張機能やWebボールトがないため、ブラウザベースの攻撃ベクトルなし</li>
<li><strong>真のゼロ知識クラウド同期:</strong> Codebook Cloudは、デバイス上で生成されアップロードされない同期キーでデータを暗号化します。Zeteticはパスワードを見ることができず、引き渡すよう強制されることもなく、データが露出するような方法でハッキングされることもありません。</li>
<li>マスターパスワードはクラウド暗号化に使用されない—完全にランダムな別の同期キーがパスワードクラッキング攻撃から保護</li>
<li>セキュリティに特化した企業による迅速で個人的なカスタマーサポート</li>
</ul>
<div data-callout-type="info" data-callout-title="️ なぜ別の同期キーが重要なのか" class="callout callout-info border-l-4 p-4 my-4 rounded-r"><div class="callout-title font-semibold mb-2">️ なぜ別の同期キーが重要なのか</div><div class="callout-content"><p>ほとんどの人は覚えやすい（したがって、ある程度推測可能な）マスターパスワードを選びます。高度な攻撃者は、暗号化されたデータに対して数十億回のパスワード推測を試みることができます。</p>
<p>Codebook Cloudは、マスターパスワードで同期データを暗号化しません。代わりに、完全にランダムな同期キー—推測不可能なランダムな文字の長い文字列—を使用します。このキーはデバイス上にのみ存在します。たとえ誰かがZeteticのサーバーから暗号化されたデータを盗んだとしても、それを解読することは数学的に不可能です。</p></div></div>

<p><strong>考慮事項:</strong></p>
<ul>
<li>Secret Agentによる自動入力は、ブラウザ拡張機能よりやや操作が多い</li>
<li>Linux非対応</li>
<li>小規模企業（ただし25年以上安定）</li>
<li>大手競合他社より知名度が低い</li>
</ul>
<p><strong>推奨対象:</strong> シームレスな利便性よりセキュリティアーキテクチャを優先するユーザー、厳格なセキュリティ要件を持つ組織、プライバシーを重視する個人、プロバイダーがデータにアクセスする能力をゼロにしたい方</p>
<hr>
<h4>1Password</h4>
<p><strong>設計思想:</strong> 強力なセキュリティ対策を備えた最高クラスのユーザー体験</p>
<p><strong>強み:</strong></p>
<ul>
<li>すべてのプラットフォームで優れた洗練されたユーザーインターフェース</li>
<li>ブラウザ拡張機能の自動入力が確実に動作</li>
<li>シークレットキーがマスターパスワード以上の暗号化レイヤーを追加</li>
<li>トラベルモードで国境通過時に機密ボールトを非表示可能</li>
<li>強力なエンタープライズ管理機能</li>
<li>データ漏洩の経験なし</li>
</ul>
<p><strong>考慮事項:</strong></p>
<ul>
<li>無料プランなし（14日間の試用版のみ）</li>
<li>Webボールトはブラウザコンテキストでパスワードを復号</li>
<li>クローズドソース（検証は第三者監査に依存）</li>
<li>価格帯が高い</li>
</ul>
<p><strong>推奨対象:</strong> シームレスな体験を優先するユーザー、簡単な共有が必要な家族、管理機能が必要な企業</p>
<hr>
<h4>Bitwarden</h4>
<p><strong>設計思想:</strong> 誰もがアクセスできる透明でオープンソースなセキュリティ</p>
<p><strong>強み:</strong></p>
<ul>
<li>完全なオープンソースで定期的に監査</li>
<li>無制限のパスワードとデバイスを含む寛大な無料プラン</li>
<li>完全な制御のためのセルフホストオプション</li>
<li>利便性のためのブラウザ拡張機能とWebボールト</li>
<li>リーズナブルな価格で強力な組織機能</li>
<li>頻繁なアップデートによるアクティブな開発</li>
</ul>
<p><strong>考慮事項:</strong></p>
<ul>
<li>ユーザーインターフェースは1Passwordほど洗練されていない</li>
<li>一部のプラットフォームで自動入力が不安定な場合あり</li>
<li>Webボールトはブラウザコンテキストでパスワードを復号（前述のWebボールトのリスクを参照）</li>
<li>VC資金調達により将来の方向性に疑問（ただしオープンソースコードは会社の変化に関係なく存続）</li>
</ul>
<p><strong>推奨対象:</strong> 予算重視のユーザー、オープンソース支持者、セルフホストを希望する組織、洗練されていないUIを許容できる技術者</p>
<div data-callout-type="info" data-callout-title="️ 「オープンソース」はセキュリティにとって何を意味するか？" class="callout callout-info border-l-4 p-4 my-4 rounded-r"><div class="callout-title font-semibold mb-2">️ 「オープンソース」はセキュリティにとって何を意味するか？</div><div class="callout-content"><p>オープンソースソフトウェアは、完全なコードを公開しています。誰でもセキュリティの欠陥や隠されたバックドアを検査できます。この透明性は以下を意味します：</p>
<ul>
<li>独立したセキュリティ研究者がコードを監査できる（実際にしている）</li>
<li>バックドアや悪意のあるコードはすぐに発見される</li>
<li>会社の主張を信頼する必要がない—検証できる</li>
</ul>
<p>Bitwardenは完全にオープンソースです。Codebookはオープンソースの暗号化であるSQLCipherを使用していますが、アプリケーション自体はオープンソースではありません。1PasswordとAppleパスワードはクローズドソースです。</p></div></div>

<hr>
<h4>Appleパスワード（iCloudキーチェーン）</h4>
<p><strong>設計思想:</strong> Appleエコシステム内でのシームレスな統合</p>
<p><strong>強み:</strong></p>
<ul>
<li>無料でAppleデバイスに内蔵</li>
<li>Appleデバイスではセットアップ不要</li>
<li>Face ID / Touch ID統合がシームレス</li>
<li>パスキー対応</li>
<li>強力な暗号化</li>
</ul>
<p><strong>考慮事項:</strong></p>
<ul>
<li>Appleエコシステム内でのみ確実に動作</li>
<li><strong>Windowsサポートに問題あり:</strong> iCloud for Windowsは存在しますが、多くの問題が報告されています：<ul>
<li>Windows 11でパスワードアプリが頻繁にクラッシュ</li>
<li>承認/同期プロセスがループで失敗することが多い（2FAコードは受け付けるが何も起こらない）</li>
<li>iOSやWindowsのアップデート後に同期が壊れることがある</li>
<li>Edge/Chrome拡張機能での自動入力が不安定</li>
<li>特定の条件が必要：同一ネットワーク、VPN無効、Windows Hello有効など</li>
<li>診断ツールが限られており、トラブルシューティングが困難</li>
</ul>
</li>
<li>Androidは完全に非対応</li>
<li>Apple以外のユーザーとパスワード共有不可</li>
<li>制御とエクスポートオプションが限定的</li>
<li>ブラウザ拡張機能はChromeとEdgeのみ（Firefox非対応）</li>
</ul>
<p><strong>推奨対象:</strong> Windows PCがなく、Appleエコシステム外で共有する必要のないApple製品のみの組織。信頼性の問題により、Apple/Windows混在環境には推奨しません。</p>
<hr>
<h4>ブラウザベースのマネージャー（Chrome、Edge、Firefox）</h4>
<p><strong>設計思想:</strong> 既存のワークフローに統合された便利さ</p>
<p><strong>強み:</strong></p>
<ul>
<li>すでに利用可能、追加インストール不要</li>
<li>無料</li>
<li>ブラウザアカウントと同期</li>
</ul>
<p><strong>考慮事項:</strong></p>
<ul>
<li>単一障害点（ブラウザアカウントの侵害=すべてのパスワード漏洩）</li>
<li>真のゼロ知識アーキテクチャなし</li>
<li>ブラウザコンテキストに限定</li>
<li>TOTP非対応</li>
<li>プロバイダー（Google、Microsoft）がデータにアクセスできる可能性</li>
</ul>
<p><strong>推奨対象:</strong> 専用ソリューションを採用しないユーザー、適切なパスワードマネージャーへの移行中の一時的な措置</p>
<div data-callout-type="info" data-callout-title="️ なぜブラウザのパスワードマネージャーは最も安全性が低いのか" class="callout callout-info border-l-4 p-4 my-4 rounded-r"><div class="callout-title font-semibold mb-2">️ なぜブラウザのパスワードマネージャーは最も安全性が低いのか</div><div class="callout-content"><p>Chromeでパスワードを保存すると、Googleアカウントに紐づけられます。これは以下を意味します：</p>
<p>1. <strong>Googleがアクセスできる:</strong> 専用のパスワードマネージャーとは異なり、ブラウザに保存されたパスワードは真の「ゼロ知識」ではありません。Googleは（同期目的で）このデータを処理できますし、実際にしています。</p>
<p>2. <strong>1つのパスワードですべてが解除される:</strong> 誰かがGoogle/Microsoftアカウントにアクセスした場合（フィッシング、パスワードの再利用、またはデータ漏洩を通じて）、メールとすべてのパスワードを同時に取得します。</p>
<p>3. <strong>責任の分離がない:</strong> 専用のパスワードマネージャーは単一目的のセキュリティツールです。ブラウザは、信頼できないウェブサイトを訪問し、不明なJavaScriptを実行し、巨大な攻撃対象領域を持つ複雑なアプリケーションです。</p>
<p>ブラウザのパスワードマネージャーは何もないよりましですが、セキュリティを真剣に考える人にとっては最も弱いオプションです。</p></div></div>

<hr>
<h2>セキュリティアーキテクチャ比較</h2>
<p><img src="/api/diagrams/password-vault-comparison-ja-4" alt="password-vault-comparison-ja-4"></p>
<p><strong>要約:</strong> Codebookのアーキテクチャは、設計によりネットワークおよびブラウザベースの脅威カテゴリ全体を排除します。ブラウザ拡張機能とWebボールトを持つソリューションは、追加の攻撃カテゴリから防御する必要があります。</p>
<div data-callout-type="info" data-callout-title="️ デバイス上のマルウェアについては？" class="callout callout-info border-l-4 p-4 my-4 rounded-r"><div class="callout-title font-semibold mb-2">️ デバイス上のマルウェアについては？</div><div class="callout-content"><p>「コンピューターにマルウェアが入ったら、パスワードを盗まれるのでは？」と思うかもしれません。</p>
<p>答えは微妙です。強力なマスターパスワードでロックされたボールトは、非常に解読が困難です。これらのツールで使用される暗号化（AES-256、SQLCipher）は、ブルートフォースで解読するには宇宙の年齢より長い時間がかかります。</p>
<strong>マルウェアの本当のリスクは、マスターパスワードのキャプチャです：</strong>
<ul>
<li>キーロガーがマスターパスワードの入力を記録する可能性</li>
<li>画面キャプチャソフトウェアが表示されたパスワードを見る可能性</li>
<li>メモリスクレイピングマルウェアがボールトのロック解除中にパスワードを読み取る可能性</li>
</ul>
<strong>自分を守る方法：</strong>
<ul>
<li>強力でユニークなマスターパスワードを使用する（前のセクションを参照）</li>
<li>オペレーティングシステムとソフトウェアを最新の状態に保つ</li>
<li>信頼できないソースからソフトウェアをインストールしない</li>
<li>積極的に使用していないときはボールトをロックする</li>
<li>モバイルでは、マスターパスワードを入力する代わりに生体認証（Face ID、指紋）を使用する</li>
</ul>
<strong>結論:</strong> デバイスが高度なマルウェアに侵害された場合、どのパスワードマネージャーも完全には保護できません。しかし、これはどのセキュリティツールにも当てはまります。ボールトの暗号化自体は強力なままです。</div></div>

<p><strong>注:</strong> これは1PasswordやBitwardenが安全でないことを意味するものではありません。各アクセスポイントに対して強力な保護を実装しています。この図はネットワークに面した攻撃対象領域のアーキテクチャの違いを示しています。</p>
<hr>
<h2>意思決定フレームワーク</h2>
<h3>優先事項に基づいて選択</h3>
<p><img src="/api/diagrams/password-vault-comparison-ja-5" alt="password-vault-comparison-ja-5"></p>
<h3>クイックリファレンス</h3>
<table><thead><tr><th>重視する点</th><th>推奨ソリューション</th></tr></thead><tbody><tr><td>最大限のセキュリティ、最小限の攻撃対象領域</td><td>Codebook</td></tr>
<tr><td>シームレスな体験、洗練されたUI</td><td>1Password</td></tr>
<tr><td>オープンソース、予算重視、セルフホスト</td><td>Bitwarden</td></tr>
<tr><td>Appleエコシステム統合、セットアップ不要</td><td>Appleパスワード</td></tr></tbody></table>
<hr>
<h2>応用編: コンビニエンスレイヤーパターン</h2>
<p>一部のユーザーは、セキュリティ優先のボールトを正式なソースとして使用しながら、頻繁にアクセスするサイト用に薄い「コンビニエンスレイヤー」を追加することで、効果的な中間点を見つけています。</p>
<p><img src="/api/diagrams/password-vault-comparison-ja-6" alt="password-vault-comparison-ja-6"></p>
<h3>なぜこれが機能するか</h3>
<ul>
<li><strong>セキュリティアーキテクチャの維持:</strong> 正式なボールトは最大限のセキュリティを維持</li>
<li><strong>日常使用がスムーズ:</strong> 頻繁にアクセスするサイトでFace ID自動入力</li>
<li><strong>レジリエンス:</strong> コンビニエンスレイヤーが壊れても問題なし—本当のデータはプライマリボールトにある</li>
<li><strong>バージョン混乱なし:</strong> プライマリボールトが常に正式ソース</li>
</ul>
<h3>必要な規律</h3>
<ol>
<li><strong>まずプライマリボールトを更新</strong>し、必要に応じてコンビニエンスレイヤーにコピー</li>
<li><strong>コンビニエンスレイヤーは最小限に</strong>—本当に高頻度のログインのみ</li>
<li><strong>コンビニエンスレイヤーにのみ保存しない</strong></li>
<li><strong>定期的なクリーンアップ</strong>—コンビニエンスレイヤーから古いエントリを削除</li>
</ol>
<h3>このパターンを検討すべき場合</h3>
<ul>
<li>セキュリティ優先ソリューションを選択したが、一部のサイトでよりスムーズな自動入力が欲しい</li>
<li>特定のサイトに1日に何十回もアクセスする</li>
<li>プライマリ優先の習慣を維持できる規律がある</li>
</ul>
<p>このパターンは、セキュリティ優先アーキテクチャを放棄することなく「ワンタップ自動入力が欲しい」という懸念に対応します。</p>
<hr>
<h2>重要なお知らせ</h2>
<h3>Microsoft Authenticatorの更新について</h3>
<p>2025年8月をもって、Microsoft Authenticatorはパスワードマネージャーとして機能しなくなりました。Microsoftはすべてのパスワード保存と自動入力機能を削除しました。アプリは以下の機能を継続します：</p>
<ul>
<li>多要素認証（MFA）プッシュ通知</li>
<li>時間ベースのワンタイムパスワード（TOTP）</li>
<li>パスキー</li>
</ul>
<p>以前Microsoft Authenticatorにパスワードを保存していた場合、そのデータはアクセスできなくなっています。代替ソリューションへの移行が完了していることをご確認ください。</p>
<h3>多要素認証の推奨事項</h3>
<p>どのパスワードマネージャーを選択する場合でも、以下を推奨します：</p>
<ul>
<li>ほとんどのアカウントには、パスワードマネージャー内蔵のTOTPを使用</li>
<li>条件付きアクセスポリシーで必要な場合は、Microsoft 365 MFA専用にMicrosoft Authenticatorを使用</li>
</ul>
<p>この分離により、パスワードボールトとMFAが単一のアプリケーションに依存しないことが保証されます。</p>
<hr>
<h2>次のステップ</h2>
<ol>
<li>上記の意思決定フレームワークを使用して優先事項を<strong>評価</strong></li>
<li>希望のソリューションを<strong>試用</strong>（ほとんどが無料試用版を提供）</li>
<li>既存のソース（ブラウザなど）から現在のパスワードを<strong>エクスポート</strong></li>
<li>新しいパスワードマネージャーに<strong>インポート</strong></li>
<li>重要なアカウントで二要素認証を<strong>有効化</strong></li>
<li>セキュリティの低い場所（ブラウザストレージなど）からパスワードを<strong>削除</strong></li>
</ol>
<div data-callout-type="info" data-callout-title="️ バックアップキーを忘れずに" class="callout callout-info border-l-4 p-4 my-4 rounded-r"><div class="callout-title font-semibold mb-2">️ バックアップキーを忘れずに</div><div class="callout-content"><p>選択するソリューションによって、以下を安全に保管する必要があります：</p>
<ul>
<li><strong>マスターパスワード:</strong> 紙に書いて安全な場所に保管（すべてのソリューション）</li>
<li><strong>同期キー:</strong> Codebook Cloudは同期用に別のキーを生成—これもバックアップ</li>
<li><strong>シークレットキー:</strong> 1PasswordはEmergency Kit PDFを提供—印刷して保管</li>
<li><strong>リカバリーコード:</strong> 多くのサービスがワンタイムリカバリーコードを提供—これらを保存</li>
</ul>
<p>信頼できる家族が必要な場合に見つけられる場所にこれらの物理的バックアップを保管してください。耐火金庫や貸金庫が理想的です。</p></div></div>

<p>これらのソリューションの移行、セットアップ、トレーニングについてサポートいたします。</p>',
  1,
  '["security","password-manager","1password","bitwarden","codebook","authentication","enterprise"]',
  '2026-01',
  'active',
  datetime('now'),
  datetime('now')
);