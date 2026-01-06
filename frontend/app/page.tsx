'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { LayoutDashboard, Heart } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center space-y-8 max-w-md"
      >
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
          className="flex justify-center"
        >
          <Heart className="h-16 w-16 text-gray-900" />
        </motion.div>
        <h1 className="text-4xl font-semibold text-gray-900">Event Platform</h1>
        <p className="text-gray-600">Select an interface to continue</p>
        <div className="space-y-3 pt-4">
          <Link href="/admin">
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-6 py-4 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors shadow-lg"
            >
              <div className="flex items-center justify-center gap-2">
                <LayoutDashboard className="h-5 w-5" />
                Admin Dashboard
              </div>
            </motion.div>
          </Link>
          <Link href="/couple">
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-6 py-4 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors shadow-lg"
            >
              <div className="flex items-center justify-center gap-2">
                <Heart className="h-5 w-5" />
                Couple Portal
              </div>
            </motion.div>
          </Link>
        </div>
      </motion.div>
    </div>
  )
}

