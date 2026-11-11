import { useEffect, useState } from "react";
import {
  getRanking,
  RankingEntry,
} from "@/services/rankingService";

interface RankingModalProps {
  onClose: () => void;
}

export default function RankingModal({
  onClose,
}: RankingModalProps) {
  const [ranking, setRanking] =
    useState<RankingEntry[]>([]);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    getRanking()
      .then((data) => {
        setRanking(data);
      })
      .catch(console.error)
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div
      className="overlay"
      style={{
        background:
          "rgba(0,0,0,0.82)",
        zIndex: 50,
      }}
    >
      <div
        className="start-card"
        style={{
          maxWidth: 700,
        }}
      >
        <div className="crest">
          ⌁ RANKING GLOBAL ⌁
        </div>

        <h1
          className="title"
          style={{
            fontSize: "2.2em",
          }}
        >
          🏆 TOP JOGADORES
        </h1>

        <div className="divider" />

        {loading ? (
          <p
            style={{
              textAlign: "center",
              color: "#9bb4d8",
            }}
          >
            Carregando ranking...
          </p>
        ) : ranking.length === 0 ? (
          <p
            style={{
              textAlign: "center",
              color: "#9bb4d8",
            }}
          >
            Nenhum aventureiro entrou
            para o ranking.
          </p>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              marginTop: 20,
            }}
          >
            {ranking.map(
              (player, index) => (
                <div
                  key={player.username}
                  className="meta"
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    alignItems:
                      "center",
                    padding:
                      "12px 16px",
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontFamily:
                          "'Press Start 2P', monospace",
                        color:
                          "#c8a960",
                        fontSize: 10,
                      }}
                    >
                      #{index + 1}
                    </span>

                    <div
                      style={{
                        marginTop: 4,
                        color:
                          "#f0e0b0",
                        fontWeight:
                          700,
                      }}
                    >
                      {
                        player.username
                      }
                    </div>
                  </div>

                  <div
                    style={{
                      textAlign:
                        "right",
                    }}
                  >
                    <div
                      style={{
                        color:
                          "#ffd166",
                        fontWeight:
                          700,
                      }}
                    >
                      {
                        player.score
                      } pts
                    </div>

                    <div
                      style={{
                        fontSize: 11,
                        color:
                          "#9bb4d8",
                      }}
                    >
                      {
                        player.gameMode
                      }
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        <div
          style={{
            marginTop: 20,
            textAlign: "center",
          }}
        >
          <button
            className="btn ghost"
            onClick={onClose}
          >
            FECHAR
          </button>
        </div>
      </div>
    </div>
  );
}