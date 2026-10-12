# Print Pipeline

Baskıya uygunluk generation sonrası prompt ile uydurulmaz. Fiziksel ölçü, hedef DPI, bleed, safe area, renk amacı ve gerekiyorsa ICC profili generation öncesinde işin parçasıdır.

- Gerçek piksel boyutu doğrulanır.
- CMYK dönüşümü color management pipeline ile yapılır.
- Raster dosya uzantı değişimiyle vector sayılmaz.
- SVG yalnızca gerçek vector content olduğunda sunulur.
- PDF/X uyumluluğu validator olmadan iddia edilmez.
