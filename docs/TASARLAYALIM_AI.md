# Tasarlayalım AI — Requirement Discovery

Tek kullanıcı yüzeyi: **Özellikler Hakkında Konuş**.

Akış:
1. Kullanıcı ihtiyacını anlatır.
2. Asistan gerekli en az sayıda açıklayıcı soru sorar.
3. Çelişki ve riskleri belirtir.
4. Bir veya birden fazla RequirementDraft çıkarır.
5. Kullanıcı “Doğru anladım” ile doğrular.
6. Doğrulanan kayıt admin kuyruğuna gider.
7. Raw conversation, AI interpretation ve confirmed requirement ayrı saklanır.

Asistan her fikri otomatik kabul etmez; riskli veya çelişkili davranışları belirtir. Kullanıcı onayı olmadan requirement kesinleşmez.
