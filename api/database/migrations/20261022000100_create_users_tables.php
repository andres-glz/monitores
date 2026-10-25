<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

/**
 * Usuarios, tokens de sesión e intentos de inicio de sesión (para limitar fuerza bruta).
 */
final class CreateUsersTables extends AbstractMigration
{
    public function change(): void
    {
        $this->table('users')
            ->addColumn('name', 'string', ['limit' => 120])
            ->addColumn('email', 'string', ['limit' => 190])
            ->addColumn('password_hash', 'string', ['limit' => 255])
            ->addColumn('is_active', 'boolean', ['default' => true])
            ->addColumn('last_login_at', 'datetime', ['null' => true])
            ->addTimestamps()
            ->addIndex(['email'], ['unique' => true])
            ->create();

        // Solo se guarda el hash SHA-256 del token; el token real vive en la cookie del navegador
        $this->table('auth_tokens')
            ->addColumn('user_id', 'integer', ['signed' => false])
            ->addColumn('token_hash', 'char', ['limit' => 64])
            ->addColumn('user_agent', 'string', ['limit' => 255, 'null' => true])
            ->addColumn('expires_at', 'datetime')
            ->addColumn('last_used_at', 'datetime', ['null' => true])
            ->addColumn('created_at', 'datetime', ['default' => 'CURRENT_TIMESTAMP'])
            ->addIndex(['token_hash'], ['unique' => true])
            ->addForeignKey('user_id', 'users', 'id', ['delete' => 'CASCADE', 'update' => 'NO_ACTION'])
            ->create();

        $this->table('login_attempts')
            ->addColumn('email', 'string', ['limit' => 190])
            ->addColumn('ip_address', 'string', ['limit' => 45])
            ->addColumn('attempted_at', 'datetime')
            ->addIndex(['email', 'attempted_at'])
            ->addIndex(['ip_address', 'attempted_at'])
            ->create();
    }
}
