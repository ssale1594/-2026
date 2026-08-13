"use client";

export default function WhatsappButton({
  listingId,
  whatsappNumber,
  listingTitle,
}: {
  listingId: string;
  whatsappNumber: string;
  listingTitle: string;
}) {
  // wa.me requires digits only (country code, no leading +/00/spaces).
  const digitsOnly = whatsappNumber.replace(/\D/g, "");
  const message = encodeURIComponent(`مرحبًا، أشوف إعلانك "${listingTitle}" بسوق الزلفي وحاب أستفسر عنه.`);
  const href = `https://wa.me/${digitsOnly}?text=${message}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        fetch("/api/contact-click", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listingId }),
          keepalive: true,
        }).catch(() => {});
      }}
      className="rounded-full bg-green-600 text-white text-sm font-medium px-4 py-2 hover:bg-green-700 transition-colors"
    >
      تواصل واتساب
    </a>
  );
}
