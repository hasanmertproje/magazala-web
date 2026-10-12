# Workspace Access & Invitations

## Yetki kaynağı

Aktif workspace cookie'si bir yetki kaynağı değildir. Sunucu her istekte session kullanıcısının gerçek `WorkspaceMember` kayıtlarını yükler. `magazala_workspace` cookie değeri yalnız bu üyeliklerden biriyle eşleşirse aktif workspace olarak kabul edilir; aksi durumda kullanıcının ilk geçerli üyeliğine geri dönülür.

## Davet oluşturma

Davetleri V1'de yalnız SUPER ADMIN oluşturabilir.

- Token `crypto.randomBytes(32)` ile CSPRNG olarak üretilir.
- Raw token yalnız davet oluşturma API yanıtında bir kez döndürülür.
- Veritabanına yalnız SHA-256 token hash yazılır.
- Audit log raw token içermez.
- Aynı workspace + e-posta için yeni davet oluşturulduğunda önceki bekleyen davetler iptal edilir.
- Davet en fazla 7 gün süreli olabilir.
- Kabul edilmiş davet yeniden kullanılamaz.
- Bekleyen davet admin tarafından iptal edilebilir.

## Yeni kullanıcı

Davet e-postası için hesap yoksa kullanıcı:

1. Davet linkini açar.
2. Kendi adını ve en az 12 karakterlik parolasını belirler.
3. Sunucu daveti transaction içinde tekrar doğrular.
4. User + WorkspaceMember oluşturulur.
5. Davet `acceptedAt` ile tüketilir.
6. Session oluşturulur ve davet edilen workspace aktif hale getirilir.

Admin hiçbir zaman müşteri parolasını belirlemez.

## Mevcut kullanıcı

Davet e-postası zaten kayıtlıysa ikinci hesap oluşturulmaz. Kullanıcı aynı hesapla giriş yapmak zorundadır. Giriş tamamlandıktan sonra davet sayfasına güvenli relative `next` yolu ile geri dönülür ve kullanıcı daveti onaylar.

Kabul sonrası yeni workspace üyeliği eklenir ve o workspace aktif hale getirilir.

## Workspace değiştirme

Birden fazla üyeliği olan kullanıcı üst bardaki workspace seçiciyi kullanabilir. `/api/workspace/switch` yalnız session kullanıcısının gerçek üyeliklerinden birine geçişe izin verir ve işlemi audit log'a yazar.

## Token sızıntısını azaltma

Davet sayfası `Referrer-Policy: no-referrer` metadata'sı kullanır. Raw token provider loglarına, application audit metadata'sına veya admin liste ekranına yazılmaz. Kaybolan bir davet URL'si geri getirilemez; eski davet iptal edilip yenisi oluşturulur.

## Logout

Logout hem session cookie'sini hem aktif workspace cookie'sini temizler.
