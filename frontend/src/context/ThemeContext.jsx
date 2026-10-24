import { useEffect, useState } from 'react'

import { ThemeContext } from './themeStore'
const THEME_KEY = 'theme'

function getInitialTheme() {
  const storedTheme = localStorage.getItem(THEME_KEY)

  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme
  }

  return 'dark'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  function toggleTheme() {
    setTheme((currentTheme) => (
      currentTheme === 'dark' ? 'light' : 'dark'
    ))
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
