type AppProps = {
  userName: string
}

export function App({ userName }: AppProps) {
  return <main>Hello {userName}</main>
}
