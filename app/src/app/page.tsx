
"use client";

import dynamic from "next/dynamic";

const HawaiiMap = dynamic(
  () => import("../components/HawaiiMap"),
  {
    ssr: false,
    loading: () => <p>Loading Hawaii map...</p>,
  }
);

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "40px",
        backgroundColor: "#f4f7fb",
        color: "#14283f",
      }}
    >
      <h1 style={{ fontSize: "40px", fontWeight: "bold" }}>
        Know Your District
      </h1>

      <p style={{ marginTop: "16px", fontSize: "18px" }}>
        Hawaii District Intelligence Platform
      </p>

      <section
        style={{
          marginTop: "30px",
          padding: "24px",
          backgroundColor: "white",
          borderRadius: "12px",
          border: "1px solid #ddd",
        }}
      >
        <h2 style={{ fontSize: "24px", fontWeight: "bold" }}>
          Explore Hawaii
        </h2>

        <p style={{ marginTop: "12px", marginBottom: "20px" }}>
          Explore Hawaii&apos;s communities, districts,
          demographics, and public resources.
        </p>

        <HawaiiMap />
      </section>
    </main>
  );
}
