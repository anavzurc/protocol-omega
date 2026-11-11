import { useState } from "react";
import {
  loginUser,
  registerUser
} from "@/services/authService";

interface Props {
  onAuthenticated: (username: string) => void;
}

export default function AuthModal({
  onAuthenticated,
}: Props) {
  const [isLogin, setIsLogin] =
    useState(true);

  const [username, setUsername] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  async function handleSubmit() {
    try {
      setError("");
      setLoading(true);

      if (isLogin) {
        const user =
          await loginUser({
            username,
            password,
          });

        onAuthenticated(
          user.get("username")
        );
      } else {
        const user =
          await registerUser({
            username,
            email,
            password,
          });

        onAuthenticated(
          user.get("username")
        );
      }
    } catch (err: any) {
      setError(
        err?.message ||
        "Erro de autenticação"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        marginTop: 20,
      }}
    >
      <input
        className="name-input"
        placeholder="Usuário"
        value={username}
        onChange={(e) =>
          setUsername(e.target.value)
        }
      />

      {!isLogin && (
        <input
          className="name-input"
          placeholder="Email"
          value={email}
          onChange={(e) =>
            setEmail(e.target.value)
          }
        />
      )}

      <input
        className="name-input"
        type="password"
        placeholder="Senha"
        value={password}
        onChange={(e) =>
          setPassword(e.target.value)
        }
      />

      {error && (
        <p
          style={{
            color: "#ff7777",
            marginBottom: 10,
          }}
        >
          {error}
        </p>
      )}

      <button
        className="btn solid"
        onClick={handleSubmit}
        disabled={loading}
      >
        {loading
          ? "AGUARDE..."
          : isLogin
          ? "ENTRAR"
          : "CADASTRAR"}
      </button>

      <div>
        <button
          className="btn ghost"
          onClick={() =>
            setIsLogin(!isLogin)
          }
        >
          {isLogin
            ? "CRIAR CONTA"
            : "JÁ POSSUO CONTA"}
        </button>
      </div>
    </div>
  );
}